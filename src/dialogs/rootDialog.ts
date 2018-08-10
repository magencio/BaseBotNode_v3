import { Session, IntentDialog, IDialogWaterfallStep, IntentRecognizer, IIntentRecognizerResult, IDialogResult, Prompts, ResumeReason } from 'botbuilder';
import { BotFrameworkInstrumentation } from 'botbuilder-instrumentation';

export class RootDialog extends IntentDialog {
    private instrumentation: BotFrameworkInstrumentation;

    constructor(recognizer: IntentRecognizer, instrumentation: BotFrameworkInstrumentation) {
        super({ recognizers: [recognizer] });
        this.instrumentation = instrumentation;
        this.matches('Education.Hi', this.onHi)
            .matches('Education.Thx', this.onThx)
            .matches('Education.Bye', this.onBye)
            .onDefault(this.onUnknown);
    }

    private onHi = (session: Session) => {
        session.send("Hi there! What can I do for you today?");
    }

    private onThx = (session: Session) => {
        session.send('You are welcome');
    }

    private onBye: IDialogWaterfallStep[] = [
        (session: Session) => {
            session.beginDialog('prompt.confirmation', 'Before you leave, did I help you?');
        },
        (session: Session, results: IDialogResult<boolean>) => {
            if (results.resumed === ResumeReason.completed) {
                if (results.response) {
                    session.send('Great to hear that!');
                } else {
                    Prompts.text(session, "Sorry to hear that. Please, tell me how I can improve");
                }
            } else {
                session.send('Sure thing');
            }
        },
        (session: Session, results: IDialogResult<boolean>) => {
            this.instrumentation.trackGoalTriggeredEvent('Feedback', { text: results.response }, session);
            session.send('Feedback noted');
        }
    ];

    private onUnknown = (session: Session, recognizerResults: IIntentRecognizerResult) => {
        this.instrumentation.trackCustomEvent('MBFEvent.CustomEvent.Unknown', { text: session.message.text, recognizerResults: recognizerResults }, session);
        session.send("Sorry, I didn't get that. I'm still learning!");
    }
}