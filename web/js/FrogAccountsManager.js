let accountsFilePath = path.join(global.USERDATA_PATH, "accounts.json");
const NICKNAME_REGEX = /^[a-zA-Z0-9_]{2,16}$/gm;

class FrogAccountsManager {
    // Получить данные аккаунтов
    static getAccounts = () => {
        if (fs.existsSync(accountsFilePath)) {
            return JSON.parse(
                fs.readFileSync(accountsFilePath)
            );
        } else {
            return this.cleanAccountsList();
        }
    }

    // Сохранить данные аккаунтов
    static saveAccounts = (accounts) => {
        fs.writeFileSync(
            accountsFilePath,
            JSON.stringify(accounts, null, "\t")
        );
        FrogCollector.writeLog("Accounts: Saved successfully");
        FrogAccountsUI.reloadAccountSelect();
        FrogAccountsUI.reloadAccountsManager();
        return true;
    }

    // Очистить список аккаутов
    static cleanAccountsList = () => {
        FrogCollector.writeLog("Accounts: Cleaned successfull");
        this.saveAccounts({});
        return {};
    }

    // Получить UUID активного аккаунта
    static getActiveAccount = () => {
        let activeAccount = FrogConfig.read("activeAccount", "none");
        if (!FrogAccountsManager.isAccountExists(activeAccount)) {
            FrogAccountsManager.setActiveAccount("none");
            return "none";
        }
        return activeAccount;
    }

    // Сохранить UUID активного аккаунта
    static setActiveAccount = (accountId) => {
        if (!FrogAccountsManager.isAccountExists(accountId)) {
            return false;
        }
        FrogConfig.write("activeAccount", accountId);
        FrogAccountsUI.reloadAccountSelect();
        FrogAccountsUI.reloadAccountsManager();
        return true;
    }

    // Получить аккаунт по UUID
    static getAccount = (uuid) => {
        return FrogAccountsManager.getAccounts()[uuid];
    }

    // Удалить аккаунт по UUID
    static removeAccount = (uuid) => {
        let accounts = FrogAccountsManager.getAccounts();
        if (typeof accounts[uuid] === "undefined") {
            return false;
        }

        accounts[uuid] = null;
        delete accounts[uuid];
        return FrogAccountsManager.saveAccounts(accounts);
    }

    // Существует ли аккаунт с таким UUID
    static isAccountExists = (uuid) => {
        let accounts = FrogAccountsManager.getAccounts();
        return typeof accounts[uuid] !== "undefined";
    }

    // Существует ли аккаунт с таким UUID
    static isAccountExistsByNickname = (nickname, type) => {
        let accounts = FrogAccountsManager.getAccounts();
        let exists = false;
        Object.values(accounts).forEach((acc) => {
            if (acc.nickname === nickname && acc.type === type) {
                exists = true;
            }
        })
        return exists;
    }

    // Получить данные аккаунта для конфигурации MCLC
    static getAccountMCLCData = (accountId, cb) => {
        if (!FrogAccountsManager.isAccountExists(accountId)) {
            return cb(false);
        }

        let accountData = FrogAccountsManager.getAccount(accountId);

        if (accountData.type === "local") {
            Authenticator.getAuth(accountData.nickname).then((authData) => {
                return cb(authData);
            });
        } else if (accountData.type === "microsoft") {
            return cb(accountData.data);
        } else {
            return cb(false);
        }
    }

    /* ДОБАВЛЕНИЕ АККАУНТОВ */
    // Добавить локальный аккаунт
    static addLocalAccount = (nickname) => {
        nickname = nickname.trim();
        if (nickname.match(NICKNAME_REGEX) === null || nickname === "") {
            return false;
        }

        if (FrogAccountsManager.isAccountExistsByNickname(nickname, "local")) {
            FrogToasts.create("Данный аккаунт уже существует");
            return true;
        }

        let accountUUID = crypto.randomUUID();
        let accountData = {
            type: "local",
            nickname: nickname,
            added: Date.now(),
            uuid: accountUUID
        }

        let accountsList = FrogAccountsManager.getAccounts();
        accountsList[accountUUID] = accountData;
        FrogAccountsManager.saveAccounts(accountsList);

        FrogToasts.create(nickname, "person", "Добавлен новый аккаунт");
        return true;
    }

    // Добавить аккаунт Microsoft
    static async addMicrosoftAccount() {
        ipcRenderer.send("use-ms-auth");

        return new Promise(resolve => {
            ipcRenderer.once("get-ms-auth-result", (event, result) => {
                let nickname = result.profile.name;
                if (FrogAccountsManager.isAccountExistsByNickname(nickname, "microsoft")) {
                    FrogToasts.create("Данный аккаунт уже существует");
                    return resolve(false);
                }
                let accountUUID = crypto.randomUUID();
                let accountData = {
                    type: "microsoft",
                    nickname: result.profile.name,
                    added: Date.now(),
                    uuid: accountUUID,
                    data: result.mclc
                }

                let accountsList = FrogAccountsManager.getAccounts();
                accountsList[accountUUID] = accountData;
                FrogAccountsManager.saveAccounts(accountsList);

                FrogToasts.create(nickname, "person", "Добавлен новый аккаунт");
                resolve(true);
            })
        })
    }
}