const MC_ASSETS_URL = "https://resources.download.minecraft.net";
let assetsPromiseResolve;
let assetsPromise;
global.assetsDownloadStatus = {
    total: 0,
    current: 0,
    percent: 0
}
let needToDownload = [];
let currentDownloadingAsset = 0;

class FrogAssets {
    // Проверить и скачать недостающие ассеты
    static verifyAndDownload = (version) => {
        return assetsPromise = new Promise((resolve) => {
            assetsPromiseResolve = resolve;
            FrogAssets.verifyAssets(version, true).then(result => {
                needToDownload = result;
                if (needToDownload.length === 0) {
                    return resolve(true);
                }
                currentDownloadingAsset = -1;
                this.downloadNextAsset();
            })
        });
    }

    static downloadNextAsset = () => {
        currentDownloadingAsset++;
        if (typeof needToDownload[currentDownloadingAsset] === "undefined") {
            return assetsPromiseResolve(true);
        }
        global.assetsDownloadStatus.current = currentDownloadingAsset;
        global.assetsDownloadStatus.percent = Math.round((global.assetsDownloadStatus.current / global.assetsDownloadStatus.total) * 100);
        let filePath = needToDownload[currentDownloadingAsset].path;
        let url = needToDownload[currentDownloadingAsset].url;
        let displayName = path.basename(filePath);
        FrogDownloader.downloadFile(url, filePath, displayName).then(() => {
            FrogAssets.downloadNextAsset();
        })
    }

    // Получить полный список файлов, которые нужно скачивать для запуска игры
    static verifyAssets(version, changeUI = true) {
        if (changeUI) {
            FrogFlyout.setUIStartMode(true);
            FrogFlyout.setText("Проверка ассетов");
            FrogFlyout.changeMode("spinner");
        }
        return new Promise(resolve => {
            let downloadsList = [];
            let assetsPath = path.resolve(path.join(global.GAME_DATA, "assets"));
            let librariesPath = path.resolve(path.join(global.GAME_DATA, "libraries"));
            FrogVersionsManager.getVersionManifest(version).then(vPkg => {
                // Создаём все папки, если их нет
                if (!fs.existsSync(assetsPath)) {
                    fs.mkdirSync(assetsPath, {recursive: true});
                }
                if (!fs.existsSync(librariesPath)) {
                    fs.mkdirSync(librariesPath, {recursive: true});
                }
                let currentOs = os.platform().replace("win32", "windows");
                // Библиотеки
                vPkg.libraries.forEach((library) => {
                    if (!library.downloads || !library.downloads.classifiers) return;
                    //if (FrogAssets.parseLibraryRule(library)) return;

                    let libraryArtifact = this.getOS() === 'osx'
                        ? library.downloads.classifiers['natives-osx'] || library.downloads.classifiers['natives-macos']
                        : library.downloads.classifiers[`natives-${this.getOS()}`];

                    let arch = os.arch() === "x64" ? "64" : "32";
                    if (typeof libraryArtifact === "undefined" && typeof library.downloads.classifiers[`natives-${this.getOS()}-${arch}`] !== "undefined") {
                        libraryArtifact = library.downloads.classifiers[`natives-${this.getOS()}-${arch}`]
                    }

                    let libraryPath = path.resolve(path.join(librariesPath, libraryArtifact.path));
                    let libraryRule, libraryRuleAction;
                    if (typeof library.rules !== "undefined" && library.rules.length > 1) {
                        library.rules.forEach((rule) => {
                            if (typeof rule.os !== "undefined") {
                                libraryRule = rule;
                                libraryRuleAction = rule.action;
                            }
                        })
                    }
                    if ((typeof library.rules === "undefined") || (typeof library.rules !== "undefined" && libraryRuleAction === "allow" && libraryRule.os.name === currentOs) || (typeof library.rules !== "undefined" && libraryRuleAction === "deny" && libraryRule.os.name !== currentOs)) {
                        if (!FrogAssets.verifyFile(libraryPath, libraryArtifact.sha1)) {
                            downloadsList.push({
                                url: libraryArtifact.url,
                                path: libraryPath
                            })
                        }
                    }
                });
                // Ассеты
                $.get(vPkg.assetIndex.url, (vAssets) => {
                    Object.values(vAssets.objects).forEach((asset) => {
                        let hash = asset.hash;
                        let subHash = hash.substring(0, 2);
                        let assetPath = path.resolve(path.join(assetsPath, "objects", subHash, hash));
                        if (!FrogAssets.verifyFile(assetPath, hash)) {
                            downloadsList.push({
                                url: MC_ASSETS_URL + "/" + hash + subHash,
                                path: assetPath
                            })
                        }
                    });
                    return resolve(downloadsList);
                });
            });
        })
    }

    // Проверить файл по хешу SHA-1
    static verifyFile(fullPath, sha1) {
        if (fs.existsSync(fullPath)) {
            let sha1sum = crypto
                .createHash("sha1")
                .update(fs.readFileSync(fullPath))
                .digest("hex");
            if (sha1sum === sha1) {
                return true;
            }
        }
        return false;
    }

    static parseLibraryRule(lib) {
        if (lib.rules) {
            if (lib.rules.length > 1) {
                if (lib.rules[0].action === 'allow' && lib.rules[1].action === 'disallow' && lib.rules[1].os.name === 'osx') {
                    return this.getOS() === 'osx'
                }
                return true
            } else {
                if (lib.rules[0].action === 'allow' && lib.rules[0].os) return lib.rules[0].os.name !== this.getOS()
            }
        } else {
            return false
        }
    }

    static getOS = () => {
        switch (process.platform) {
            case 'win32':
                return 'windows';
            case 'darwin':
                return 'osx';
            default:
                return 'linux';
        }
    }
}