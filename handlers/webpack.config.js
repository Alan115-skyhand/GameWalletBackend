const path = require("path")
const { IgnorePlugin } = require('webpack');
module.exports = {
    context: path.join(__dirname, "src", "functions"),
    entry: {
        "AddConnection": "./AddConnection.js",
        "RemoveConnection" : "./RemoveConnection.js",
        "BroadcastUpdate": "./BroadcastUpdate.js",
        "SaveUpdate": "./SaveUpdate.js",
        "GetBalance": "./GetBalance.js",
        "GetPrice": "./GetPrice.js",
        "GetSupportedAssets": "./GetSupportedAssets.js",
        "GetSupportedCurrencies": "./GetSupportedCurrencies.js",
        "ListPortfolios": "./ListPortfolios.js",
        "CreatePortfolio": "./CreatePortfolio.js",
        "DepositAsset": "./DepositAsset.js",
        "DepositToken": "./DepositToken.js",
        "DepositTokenWebhook": "./DepositTokenWebhook.js",
        "WithdrawAsset": "./WithdrawAsset.js",
        "CreateTrade": "./CreateTrade.js",
        "CancelTrade": "./CancelTrade.js",
        "ListAssets": "./ListAssets.js",
        "ListTrades": "./ListTrades.js",
        "ListWallets": "./ListWallets.js",
        "ProcessOpenTrades": "./ProcessOpenTrades.js",
        "AddTradeStreamConnection": "./AddTradeStreamConnection.js",
        "AddDepositStreamConnection": "./AddDepositStreamConnection.js",
        "RemoveTradeStreamConnection": "./RemoveTradeStreamConnection.js",
        "RemoveDepositStreamConnection": "./RemoveDepositStreamConnection.js",
        "BroadcastTradeUpdate": "./BroadcastTradeUpdate.js",
        "BroadcastAssetUpdate": "./BroadcastAssetUpdate.js",
        "CreateUser": "./CreateUser.js",
        "LoginUser": "./LoginUser.js",
        "ListTransactions": "./ListTransactions.js"
    },
    mode: "development",
    target: "node",
    devtool: false,
    output: {
        libraryTarget: "umd",
        path: path.join(__dirname, "build", "webpack"),
        filename: "[name]/index.js"
    },
    plugins: [
        new IgnorePlugin({
            resourceRegExp: /electron/,
        }),
    ],
}
