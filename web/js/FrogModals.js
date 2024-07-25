class FrogModals {
    // Показать модальное окно
    static showModal = (modalName) => {
        FrogCollector.writeLog(`Modal: Show "${modalName}"`);

        document.dispatchEvent(new CustomEvent("showModalEvent", {
            detail: {modal: modalName}
        }));
        return new Promise((resolve) => {
            if (!FrogModals.isModalShown(modalName)) {
                let modalElem = $(`.modal#modal-${modalName}`);
                modalElem.show();
                if (modalElem[0].tagName === "DIALOG") {
                    modalElem[0].showModal();
                }
                animateCSSNode(modalElem[0], "fadeInUp").then(() => {
                    resolve(true);
                });
            } else {
                resolve(false);
            }
        })
    }

    // Скрыть модальное окно
    static hideModal = (modalName) => {
        FrogCollector.writeLog(`Modal: Hide "${modalName}"`);

        document.dispatchEvent(new CustomEvent("hideModalEvent", {
            detail: {modal: modalName}
        }));
        return new Promise((resolve) => {
            if (FrogModals.isModalShown(modalName)) {
                let modalElem = $(`.modal#modal-${modalName}`);
                animateCSSNode(modalElem[0], "fadeOutDown").then(() => {
                    modalElem.hide();
                    resolve(true);
                });
            } else {
                resolve(false);
            }
        })
    }

    // Показать контент
    static showContent = () => {
        return new Promise((resolve) => {
            $(".content .content-inner").show();
            animateCSSNode($(".content .content-inner")[0], "fadeInUp").then(() => {
                resolve(true);
            });
        });
    }

    // Скрыть контент
    static hideContent = () => {
        return new Promise((resolve) => {
            $(".content .content-inner").removeClass("animate__animated animate__zoomIn animate__faster");
            animateCSSNode($(".content .content-inner")[0], "fadeOutDown").then(() => {
                $(".content .content-inner").hide();
                resolve(true);
            });
        });
    }

    // Переключить окно (если сейчас показано какое-либо)
    static switchModal = (modalName) => {
        FrogFlyout.lockFlymenu();
        return new Promise((resolve) => {
            if (FrogModals.isModalShown()) {
                FrogModals.hideCurrentModal().then(() => {
                    FrogModals.showModal(modalName).then(resolve);
                    FrogFlyout.unlockFlymenu();
                })
            } else {
                FrogModals.hideContent().then(() => {
                    FrogModals.showModal(modalName).then(resolve);
                    FrogFlyout.unlockFlymenu();
                })
            }
        });
    }

    // Скрыть модальное окно, которое сейчас открыто
    static hideCurrentModal = () => {
        return new Promise((resolve) => {
            let currentModalElement = $(`.modal[style!="display: none;"]:not(.overlay)`);
            let currentModalName = $(currentModalElement).attr("id").replace("modal-", "");
            FrogModals.hideModal(currentModalName).then(resolve);
        })
    }

    // Показано ли модальное окно (если "", то любое из окон)
    static isModalShown = (modalName = "") => {
        if (modalName !== "") {
            return $(`.modal#modal-${modalName}`).css("display") !== "none";
        } else {
            return $(`.modal[style!="display: none;"]:not(.overlay)`).length > 0;
        }
    }
}