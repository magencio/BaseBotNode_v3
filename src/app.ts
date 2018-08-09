import { config }  from './config';
import * as restify from 'restify';
import * as path from 'path';
import { ChatConnector, UniversalBot, LuisRecognizer } from 'botbuilder';
import { DocumentDbClient, AzureBotStorage } from 'botbuilder-azure';
import * as logger from './services/logger';
import { BotFrameworkInstrumentation } from 'botbuilder-instrumentation';
import { RootDialog } from './dialogs/rootDialog';
import { ConfirmationDialog } from './prompts/confirmationDialog';
import { NumberDialog } from './prompts/numberDialog';

const connector = createChatConnector();
const bot = createBot(connector);
const server = createServer(connector, bot);
const recognizer = createRecognizer();
const instrumentation = setupBotInstrumentation(bot, recognizer);
setupBotLocalization(bot);
setupBotStateStorage(bot);
setupBotDialogs(bot, recognizer, instrumentation);

function createChatConnector() : ChatConnector {
    return new ChatConnector({
        appId: config.get('MicrosoftAppId'),
        appPassword: config.get('MicrosoftAppPassword'),
        openIdMetadata: config.get('BotOpenIdMetadata')
    });
}

function createBot(connector: ChatConnector) : UniversalBot {
    return new UniversalBot(connector);
}

function createServer(connector: ChatConnector, bot: UniversalBot) : any {
    const server = restify.createServer();
    server.use(restify.plugins.queryParser());
    server.listen(process.env.port || process.env.PORT || 3977, function () {
        console.log('%s listening to %s', server.name, server.url);
    });

    server.post('/api/messages', connector.listen());
    return server;
}

function createRecognizer() : LuisRecognizer {
    return new LuisRecognizer(
        config.get('LUIS_apiHostName') + '/' +
        config.get('LUIS_appId') + '?subscription-key=' +
        config.get('LUIS_apiKey') + '&q=');
}

function setupBotLocalization(bot: UniversalBot) {
    bot.set('localizerSettings', {
        botLocalePath: path.join(__dirname, '../locale'),
        defaultLocale: "en"
    });
}

function setupBotInstrumentation(bot: UniversalBot, recognizer: LuisRecognizer) : BotFrameworkInstrumentation {
    bot.use({
        botbuilder: logger.onMessageReceived,
        send: logger.onMessageSent
    });

    const instrumentation = new BotFrameworkInstrumentation({
        instrumentationKey: config.get('BotDevAppInsightsKey'),
        sentiments: {
            key: config.get('CG_SENTIMENT_KEY')
        },
        autoLogOptions: {
            autoCollectExceptions: true
            }
        });
    instrumentation.monitor(bot, recognizer);
    return instrumentation;
}

function setupBotStateStorage(bot: UniversalBot) {
    const cosmosDbClient = new DocumentDbClient({
        host: config.get('COSMOSDB_host'),
        masterKey: config.get('COSMOSDB_key'),
        database: 'botdocs',
        collection: 'botdata'
    });
    const storage = new AzureBotStorage({ gzipData: false }, cosmosDbClient);
    bot.set('storage', storage);
}

function setupBotDialogs(bot: UniversalBot, recognizer: LuisRecognizer, instrumentation: BotFrameworkInstrumentation) {
    bot.dialog('/', new RootDialog(recognizer, instrumentation));
    bot.dialog('prompt.confirmation', new ConfirmationDialog(recognizer));
    bot.dialog('prompt.number', new NumberDialog(recognizer));
    bot.on('conversationUpdate', (message) => {
        if (message.membersAdded.find(m => m.id === message.user.id)) {
            bot.loadSession(message.address, (err, session) => {
                session.send('welcome.userConnected');
            });
        }
    });
}