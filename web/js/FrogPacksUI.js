let packs_currentMode = "mods";
let packs_currentOffset = 0;
let packs_scrollIsLoading = false;

const MODRINTH_MODS_API_URL = "https://api.modrinth.com/v2/search?";
const MODS_FILTERS_URL = global.CDN_URL + "/filters.json";

class FrogPacksUI {
    // Создать пак из UI
    static createPack = () => {
        let packVersion = FrogVersionsManager.getActiveVersion();
        let $packNameInput = $("#modal-packs .newPackTab input");
        let packName = $packNameInput.val();
        if (packName !== "" && packVersion !== "none") {
            $packNameInput.val("");
            FrogPacks.createPack(packVersion, packName);
            FrogAlerts.create("Ok!", MESSAGES.packs.created, MESSAGES.commons.close, "check_circle");
            FrogPacksUI.refreshDirectorySelect();
        }
    }

    // Задать режим (mods, modpacks, resourcepacks, shaders, myPacks)
    static setCurrentMode = (mode) => {
        let allowedModes = ["mods", "modpacks", "resourcepacks", "shaders"];
        if (!allowedModes.includes(mode)) {
            return false;
        }
        packs_currentMode = mode;
        return packs_currentMode;
    }

    // Загрузить список установленных
    static loadInstalledList = () => {
        const scanDirectories = ["mods", "shaderpacks", "resourcepacks"];
        let $installedList = $("#modal-packs .installedList .scroll-wrap");
        $installedList.html("");
        let modpackId = $("#modal-packs select").val();

        let listResult = {};
        let isModpack = false;

        // Корень пути для сканирования
        let rootScanPath = global.GAME_DATA;
        if (FrogPacks.isModpackExists(modpackId)) {
            isModpack = true;
            rootScanPath = path.join(global.GAME_DATA, "modpacks", modpackId);
        }

        // Сканируем все нужные директории
        scanDirectories.forEach((dir) => {
            let scanPath = path.join(rootScanPath, dir);
            if (fs.existsSync(scanPath)) {
                let directoryRd = fs.readdirSync(scanPath);
                // Все файлы добавляем в список
                directoryRd.forEach((item) => {
                    listResult[item] = {
                        file: item,
                        displayName: path.parse(item).name,
                        path: path.join(scanPath, item),
                        type: dir,
                        inConfigOf: false
                    };
                })
            }
        })

        // Если это модпак, то ищем DisplayName для каждого
        if (isModpack) {
            let modpackFiles = FrogPacks.getModpackManifest(modpackId).files;
            modpackFiles.forEach((file) => {
                if (typeof listResult[file.name] !== "undefined") {
                    listResult[file.name].displayName = file.displayName;
                    listResult[file.name].inConfigOf = modpackId;
                } else {
                    listResult[file.name] = {
                        file: file.name,
                        displayName: file.displayName,
                        path: path.join(rootScanPath, file.name),
                        type: file.name.split("/")[0],
                        inConfigOf: modpackId
                    }
                }
            })
        }

        // Добавляем ресурсы в список
        Object.values(listResult).forEach(mod => {
            let icon;
            switch (mod.type) {
                case "mods":
                    icon = "deployed_code_update";
                    break;
                case "resourcepacks":
                    icon = "landscape";
                    break;
                case "shaderpacks":
                    icon = "light_mode";
                    break;
                default:
                    icon = "archive";
                    break;
            }
            let onClickFunc = `FrogPacks.deleteFileFromModpack('${mod.path}')`;
            if (mod.inConfigOf !== false) {
                onClickFunc = `FrogPacks.deleteFileFromModpack('${mod.path}', true, '${mod.inConfigOf}')`;
            }
            onClickFunc = onClickFunc.replaceAll("\\", "/");
            $installedList.append(`<div class="item" data-filename="${mod.file}">
                    <span class="icon material-symbols-outlined">${icon}</span>
                    <span class="name">${mod.displayName}</span>
                    <button><span class="material-symbols-outlined" onclick="${onClickFunc}">delete</span></button>
                </div>`);
        })
        return listResult;
    }

    // Включить фильтры по ID модпака
    static loadFiltersByModpackID = () => {
        if ($("#modal-packs select").val() === "default") {
            // Убираем все отмеченные чекбоксы
            $(`#modal-packs .filters__scroll-wrapper input[type="checkbox"]`).removeAttr("checked").removeProp("checked");
            return false;
        }
        let modpackId = $("#modal-packs select").val();
        if (!FrogPacks.isModpackExists(modpackId)) {
            return false;
        }
        let packData = FrogPacks.getModpackManifest(modpackId);

        // Убираем все отмеченные чекбоксы
        $(`#modal-packs .filters__scroll-wrapper input[type="checkbox"]`).removeAttr("checked").removeProp("checked");

        // Отмечаем нужные
        $(`.filters__scroll-wrapper input[value="${packData.baseVersion.type}"]`).attr("checked", true);
        $(`.filters__scroll-wrapper input[value="${packData.baseVersion.number}"]`).attr("checked", true);
        return true;
    }

    // Загрузить фильтры
    static loadFilters = () => {
        return new Promise(resolve => {
            $.get(MODS_FILTERS_URL, (result) => {
                let currentProjType = FrogPacksUI.currentProjectType();
                // Сохраняем отмеченные чекбоксы
                let selectedCheckboxes = [];
                $(`.filters__scroll-wrapper input[type="checkbox"]:checked`).each(function () {
                    selectedCheckboxes.push($(this).attr("value"))
                })

                // Очищаем список
                $(`.filters__scroll-wrapper input[type="checkbox"]`).unbind("click");
                $("#filtersLoaders").html("");
                $("#filtersVersions").html("");

                // Загружаем список версий игры
                result.versions.forEach(ver => {
                    $("#filtersVersions").append(`
    <input type="checkbox" class="checkbox" id="ver-${ver}" value="${ver}">
    <label for="ver-${ver}">${FrogUtils.capitalizeWord(ver)}</label>`);
                });

                // Загружаем список лоудеров
                result.loaders.forEach(lod => {
                    if (lod.supported_project_types.includes(currentProjType)) {
                        $("#filtersLoaders").append(`
    <input type="checkbox" class="checkbox" id="lod-${lod.name}" value="${lod.name}">
    <label for="lod-${lod.name}">${FrogUtils.capitalizeWord(lod.name)}</label>`);
                    }
                });

                // Восстанавливаем отмеченное
                selectedCheckboxes.forEach(chkId => {
                    let $chkbox = $(`.filters__scroll-wrapper input[value="${chkId}"]`);
                    if ($chkbox.length > 0) {
                        $chkbox.attr("checked", true);
                        $chkbox.prop("checked", true);
                    }
                })

                // Настраиваем фильтры для модпака (если требуется)
                FrogPacksUI.loadFiltersByModpackID();

                // Биндим переключение
                $(`.filters__scroll-wrapper input[type="checkbox"]`).on("change", () => {
                    FrogPacksUI.reloadAll(true, false, true);
                })

                return resolve(true);
            })
        })
    }

    // Получить facets из фильтров
    static filtersToFacets = () => {
        let facets = ``;
        let currentProjType = FrogPacksUI.currentProjectType();
        facets = `[["project_type:${currentProjType}"]`;

        let selectedVersions = [];
        let selectedLoaders = [];
        $("#filtersVersions input:checked").each(function () {
            selectedVersions.push($(this).attr("value"));
        })
        $("#filtersLoaders input:checked").each(function () {
            selectedLoaders.push($(this).attr("value"));
        })

        if (selectedVersions.length === 0 && selectedLoaders.length === 0) {
            facets += "]";
            return facets;
        }

        if (selectedVersions.length > 0) {
            // Добавляем версии в facets
            facets += ", [";
            selectedVersions.forEach(function (ver, i) {
                if (i === (selectedVersions.length - 1)) {
                    facets += `"versions:${ver}"`
                } else {
                    facets += `"versions:${ver}", `
                }
            })
            facets += "]";
        }

        if (selectedLoaders.length > 0) {
            // Добавляем лоудеры в facets
            facets += ", [";
            selectedLoaders.forEach(function (lod, i) {
                if (i === (selectedLoaders.length - 1)) {
                    facets += `"categories:${lod}"`
                } else {
                    facets += `"categories:${lod}", `
                }
            })
            facets += "]";
        }

        facets += "]";
        return facets;
    }

    // Получить тип проекта для фильтрации (из currentPacksMode)
    static currentProjectType = () => {
        switch (packs_currentMode) {
            case "mods":
                return "mod";
            case "modpacks":
                return "modpack";
            case "resourcepacks":
                return "resourcepack";
            case "shaders":
                return "shader";
            default:
                return "project";
        }
    }

    // Сгенерировать ссылку на Modrinth
    static generateURL(
        urlStart,
        query = "",
        facets = "",
        offset = packs_currentOffset,
        limit = 20,
        sort = "downloads"
    ) {
        let fullUrl = urlStart;
        let urlAddons = "";
        let params = {
            query: query,
            offset: offset,
            limit: limit,
            index: sort,
            facets: facets
        }
        query === "" && delete params.query;
        offset == "" && delete params.offset;
        limit == "" && delete params.limit;
        sort === "" && delete params.index;
        facets === "" && delete params.facets;
        if (query != "") {
            urlAddons = "query=" + query;
        }
        urlAddons = encodeGetParams(params);
        fullUrl = fullUrl + urlAddons;
        return fullUrl;
    }

    // Открыть ссылку на проект в браузере
    static openProjectURL = (id) => {
        return openExternal(`https://modrinth.com/mod/${id}`);
    }

    // Прогрузить список далее
    static loadMore = () => {
        let savedScroll = $("#modal-packs .packs-wrapper").scrollTop();
        packs_currentOffset += 20;
        FrogPacksUI.reloadAll(false, false, false).then(() => {
            $("#modal-packs .packs-wrapper").scrollTop(savedScroll - 16);
            packs_scrollIsLoading = false;
        });
    }

    // Загрузить список версий для проекта
    static loadVersionsList = (projectId) => {
        return new Promise(resolve => {
            let $versionList = $(`#modal-packs .packs-list .item[data-id="${projectId}"] .versions-list`);
            let $itemElem = $(`#modal-packs .packs-list .item[data-id="${projectId}"]`);

            // Показываем UI загрузки
            $itemElem.addClass("opened");
            $itemElem.find(".button button.pill").hide();
            $itemElem.find("#versions-list-preloader").show();

            if ($versionList.length === 0) {
                return resolve(false);
            }
            $versionList.html("");
            // Получаем список версий
            $.get(`https://api.modrinth.com/v2/project/${projectId}/version`, (result) => {

                let selectedVersions = [];
                let selectedLoaders = [];
                $("#filtersVersions input:checked").each(function () {
                    selectedVersions.push($(this).attr("value"));
                })
                $("#filtersLoaders input:checked").each(function () {
                    selectedLoaders.push($(this).attr("value"));
                })

                // Загружаем его
                result.forEach((item) => {
                    let mappedLoaders = item.loaders.map(function (e) {
                        e = FrogUtils.capitalizeWord(e);
                        return e;
                    });

                    if ((FrogUtils.compareArrays(selectedVersions, item.game_versions).length > 0 || selectedVersions.length === 0) && (FrogUtils.compareArrays(selectedLoaders, item.loaders).length > 0 || selectedLoaders.length === 0)) {
                        let installFunction = `FrogPacks.downloadByVersionID('${item.id}', this)`;
                        if (item.loaders[0] === "datapack") {
                            installFunction = `FrogUI.selectWorld().then(result => FrogPacks.downloadByVersionID('${item.id}', this, path.join(result, 'datapacks')))`;
                        }
                        $versionList.append(`<div class="item">
<span class="title">${item.name}</span>
<div class="flex flex-align-center flex-gap-4 versions">${mappedLoaders.join(", ")} <div class="microdot"><div style="background: var(--theme-primaryBg)" class="dot"></div></div> ${item.game_versions.join(", ")}</div>
${!FrogPacksUI.isFileInstalled(item.files[0].filename) ? `<button class="small pill" onclick="${installFunction}">${MESSAGES.commons.install}</button>` : `<span class="material-symbols-outlined">download_done</span>`}
</div>`);
                    }
                })
                $itemElem.find("#versions-list-preloader").hide();
            });
        })
    }

    // Проверить, установлен ли уже этот файл
    static isFileInstalled = (filename) => {
        if (packs_currentMode === "modpacks") {
            let preparedId = FrogPacks.modpackCleanID(filename.replace(".mrpack", ""));
            return FrogPacks.isModpackExists(preparedId);
        }
        let modpackId = $("#modal-packs select").val();
        if (!FrogPacks.isModpackExists(modpackId)) {
            return fs.existsSync(path.join(global.GAME_DATA, "mods", filename)) || fs.existsSync(path.join(global.GAME_DATA, "shaderpacks", filename)) || fs.existsSync(path.join(global.GAME_DATA, "resourcepacks", filename));
        }
        return fs.existsSync(path.join(global.GAME_DATA, "modpacks", modpackId, "mods", filename)) || fs.existsSync(path.join(global.GAME_DATA, "modpacks", modpackId, "shaderpacks", filename)) || fs.existsSync(path.join(global.GAME_DATA, "modpacks", modpackId, "resourcepacks", filename));
    }

    // Загрузить список модов
    static loadModsList = (clearBefore = true) => {
        return new Promise(resolve => {
            if (clearBefore) {
                $("#modal-packs .packs-list .item:not(.placeholder)").remove();
            }
            $("#modal-packs .packs-list").hide();
            $("#modal-packs .preloader").show();
            let query = $("#modal-packs input.search").val();
            let facets = FrogPacksUI.filtersToFacets();
            let modrinthUrl = FrogPacksUI.generateURL(MODRINTH_MODS_API_URL, query, facets);
            $.get(modrinthUrl, result => {
                // Получаем код placeholder`а
                let placeholder = $("#modal-packs .item.placeholder")[0].outerHTML;
                placeholder = placeholder.replace(' placeholder', "");
                // По placeholder`у добавляем новые элементы
                result.hits.forEach((item) => {
                    if (item.icon_url === "") {
                        item.icon_url = "assets/modIcon.webp";
                    }
                    let preparedPlaceholder = placeholder.replaceAll("$1", item.icon_url).replaceAll("$2", item.title).replaceAll("$3", item.description).replaceAll("$4", kFormatter(item.downloads)).replaceAll("$5", kFormatter(item.follows)).replaceAll("$6", item.slug);
                    $("#modal-packs .packs-list").append(preparedPlaceholder);
                })

                // Помечаем нужные аккаунты в списке активными
                $("#modal-packs .packs-list .item").each(function () {
                    if (!$(this).hasClass("placeholder")) {
                        $(this).show();
                    }
                })

                // Анимация плашки с каждым модов
                if (FrogConfig.read("disableAnimations", false) !== true) {
                    $("#modal-packs .packs-list .item").each(function (index) {
                        $(this).css("opacity", 0);
                        setTimeout(() => {
                            animateCSSNode($(this)[0], "fadeIn").then(() => {
                                $(this).css("opacity", 1);
                            })
                        }, 20 * index)
                    })
                }
                $("#modal-packs .packs-list").show();
                $("#modal-packs .preloader").hide();
                return resolve(true);
            })
        })
    }

    // Перезагрузить всё
    static reloadAll = (resetPacksOffset = false, reloadFilters = true, clearBefore = true) => {
        return new Promise(resolveThis => {
            if (resetPacksOffset === true) {
                packs_currentOffset = 0;
            }
            FrogPacksUI.refreshDirectorySelect();
            if (reloadFilters) {
                FrogPacksUI.loadFilters().then(() => {
                    FrogPacksUI.loadInstalledList();
                    FrogPacksUI.loadModsList(clearBefore).then(() => {
                        resolveThis(true);
                    });
                });
            } else {
                FrogPacksUI.loadInstalledList();
                FrogPacksUI.loadModsList(clearBefore).then(() => {
                    resolveThis(true);
                });
            }
        })
    }

    // Обновить список папок для выбора места установки
    static refreshDirectorySelect = () => {
        let $select = $("#packs_dirList");
        let $updateSelect = $("#mods-update-pack-select");
        let selectedOption = $select.val();
        $select.html("");
        $updateSelect.html("");
        $select.append(`<option value="default">${MESSAGES.packs.defaultDir}</option>`);
        let myPacks = FrogPacks.getPacksList();
        let isAnyActiveSet = false;
        myPacks.forEach((pack) => {
            let packData = FrogPacks.getModpackManifest(pack);
            if (packData.id === selectedOption) {
                isAnyActiveSet = true;
            }
            $updateSelect.append(`<option value="${packData.id}" ${packData.id === selectedOption ? "selected" : ""}>${packData.displayName}</option>`);
            $select.append(`<option value="${packData.id}" ${packData.id === selectedOption ? "selected" : ""}>${packData.displayName}</option>`);
        });
        if (!isAnyActiveSet) {
            $select.val("default");
        }
    }
}

function kFormatter(num) {
    return Math.abs(num) > 999 ? Math.sign(num) * ((Math.abs(num) / 1000).toFixed(1)) + 'k' : Math.sign(num) * Math.abs(num)
}

const encodeGetParams = p =>
    Object.entries(p).map(kv => kv.map(encodeURIComponent).join("=")).join("&");