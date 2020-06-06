import React, { Component, ReactElement } from "react";

// css
import "../../assets/debug.css";

// modules
import { nanoid } from "nanoid";

// components
import Teletype from "../Teletype";
import Link from "../Link";
import Text from "../Text";
import Image from "../Image";
import Prompt, { PROMPT_DEFAULT } from "../Prompt";
import Modal from "../Modal";

// import Screen from "../Screen";

// import sample data for development purposes
import json from "../../data/sample.json";

interface AppState {
    screens: Screen[];
    dialogs: any[];
    activeScreenId: string;
    activeElementId: string; // which element, if any, is active
    activeDialogId: string; // which element, if any, is active
    loadingQueue: any[];
    status: AppStatus;
}

enum DialogType {
    Unknown = 0,
    Alert, // simple message box
    Confirm, // yes/no box; currently unsupported
    Dialog, // has arbitrary content; currently unsupported
}

interface Dialog {
    id: string;
    type: DialogType;

    [key: string]: any; // arbitrary members
}

enum ScreenType {
    Unknown = 0,
    Screen,
}

enum ScreenDataType {
    Unknown = 0,
    Text,
    Link,
    Image,
    Prompt,
}

enum ScreenDataState {
    Unloaded = 0,
    Ready,
    Active,
    Done,
}

interface ScreenData {
    id: string;
    type: ScreenDataType;
    state: ScreenDataState;

    [key: string]: any; // arbitrary members
}

interface Screen {
    id: string;
    type: ScreenType;
    content: ScreenData[];
}

enum AppStatus {
    Unset = 0,
    Ready,
    Active,
    Done,
}

class Phosphor extends Component<any, AppState> {
    constructor(props: any) {
        super(props);

        this.state = {
            screens: [],
            dialogs: [],
            activeScreenId: null,
            activeElementId: null,
            activeDialogId: null,
            loadingQueue: [],
            status: AppStatus.Unset,
        };

        this._changeScreen = this._changeScreen.bind(this);
        this._setElementState = this._setElementState.bind(this);
        this._handleCommand = this._handleCommand.bind(this);
    }

    public render(): ReactElement {
        const {
            activeScreenId,
            activeDialogId,
        } = this.state;

        return (
            <div className="phosphor">
                <section>
                    {activeScreenId && this._renderScreen()}
                </section>

                {activeDialogId && this._renderDialog()}
            </div>
        );
    }

    public componentDidMount(): void {
        // parse the data & prep the screens
        this._parseScreens();
        this._parseDialogs();
    }

    private _parseScreens(): void {
        const screens = json.screens.map((element) => {
            return this._buildScreen(element);
        });

        if (!screens.length) {
            return;
        }

        // todo: support config option to set starting screen
        const activeScreen = 0;
        this.setState({
            screens,
        }, () => this._setActiveScreen(activeScreen));
    }

    private _parseDialogs(): void {
        const dialogs = json.dialogs.map((element) => {
            return this._buildDialog(element);
        });

        if (!dialogs.length) {
            return;
        }

        this.setState({
            dialogs,
        });
    }

    private _buildDialog(src: any): Dialog {
        const id = src.id || null;
        const type = this._getDialogType(src.type);

        // TODO: support other dialog types
        let content: any [] = null;
        if (type === DialogType.Alert) {
            content = src.content;
        }

        return {
            id,
            type,
            content,
        };
    }

    private _getDialogType(type: string): DialogType {
        switch (type.toLowerCase()) {
            case "alert":
                return DialogType.Alert;

            case "confirm":
                return DialogType.Confirm;

            case "dialog":
                return DialogType.Dialog;

            default:
                return DialogType.Unknown;
        }
    }

    private _setActiveScreen(index: number): void {
        const { screens, } = this.state;
        const activeScreen = screens[index].id
        this.setState({
            activeScreenId: activeScreen,
        }, () => this._activateScreen());
    }

    // we're off to the races!
    private _activateScreen(): void {
        const screen = this._getScreen(this.state.activeScreenId);

        screen.content[0].state = ScreenDataState.Active;

        // update the app status
        const status = AppStatus.Active;
        this.setState({
            status,
            activeElementId: screen.content[0].id,
        });
    }

    private _buildScreen(src: any): Screen {
        // try to parse & build the screen
        const id = src.id || null;
        const type = this._getScreenType(src.type);
        const content = this._parseScreenContent(src.content).flat(); // flatten to one dimension

        // if this screen is invalid for any reason, skip it
        if (!id || !type || !content.length) {
            return;
        }

        return {
            id,
            type,
            content,
        };
    }

    private _getScreenType(type: string): ScreenType {
        switch (type.toLowerCase()) {
            case "screen":
                return ScreenType.Screen;

            default:
                return ScreenType.Unknown;
        }
    }

    private _renderScreen(): ReactElement[] {
        // get the active screen
        const screen = this._getScreen(this.state.activeScreenId);
        if (!screen) {
            return;
        }

        // loop through the screen contents & render each element
        return screen.content.map((element, index) => {
            // wrap a div around the element based on its state

            // if it's ready, do nothing
            if (element.state === ScreenDataState.Ready) {
                return null;
            }

            // if it's active, render it animated
            if (element.state === ScreenDataState.Active) {
                return (
                    <div className="active" key={index}>
                        {this._renderActiveElement(element, index)}
                    </div>
                );
            }

            // if it's done, render it static
            if (element.state === ScreenDataState.Done) {
                return (
                    <div className="rendered" key={index}>
                        {this._renderStaticElement(element, index)}
                    </div>
                );
            }

            // unknown
            return null;
        });
    }

    private _getScreen(id: string): Screen {
        return this.state.screens.find(element => element.id === id);
    }

    private _parseScreenContent(content: any[]): ScreenData[] {
        const parsed = content.map(element => this._parseScreenContentElement(element)).flat();
        return parsed.map(element => this._generateScreenData(element));
    }

    private _generateScreenData(element: any): ScreenData {
        // TODO: build the data object based on the element type
        // e.g. typeof element === "string" --> create a new ScreenData Text object
        const id = nanoid();

        // if an element has "load" property, its requires more work
        // to prepare so it's can't yet be considered "ready".
        const onLoad = element.onLoad || null;
        // if an element requires more loading, we'll shove its id in the queue
        if (onLoad) {
            const loadingQueue = [...this.state.loadingQueue];
            loadingQueue.push(element.id);
            this.setState({
                loadingQueue
            });
        }
        const state = onLoad ? ScreenDataState.Unloaded : ScreenDataState.Ready;

        // text-only elements can be added as strings in the JSON data; they don't need any object wrappers
        if (typeof element === "string") {
            return {
                id,
                type: ScreenDataType.Text,
                text: element,
                state,
                onLoad,
            }
        }

        // everything else requires a wrapper containing a "type" attribute, so we'll need to parse those here
        if (!element.type) {
            return;
        }

        switch (element.type.toLowerCase()) {
            case "text":
                return {
                    id,
                    type: ScreenDataType.Text,
                    text: element.text,
                    className: element.className,
                    state,
                    onLoad,
                }

            case "link":
                return {
                    id,
                    type: ScreenDataType.Link,
                    target: element.target,
                    className: element.className,
                    text: element.text,
                    state,
                    onLoad,
                };

            case "image":
                return {
                    id,
                    type: ScreenDataType.Image,
                    src: element.src,
                    alt: element.alt,
                    className: element.className,
                    state,
                    onLoad,
                };

            case "prompt":
                return {
                    id,
                    type: ScreenDataType.Prompt,
                    prompt: element.prompt || PROMPT_DEFAULT,
                    className: element.className,
                    commands: element.commands,
                    state,
                    onLoad,
                };

            default:
                return;
        }
    }

    private _parseScreenContentElement(element: any): any {
        // if the element is a string, we'll want to
        // split it into chunks based on the new line character
        if (typeof element === "string") {
            return element.split("\n");
        }

        // otherwise, just return the element
        return element;
    }

    // based on the current active ScreenData, render the corresponding active element
    private _renderActiveElement(element: any, key: number): ReactElement {
        // if the element is text-based, like text or Link, render instead a
        // teletype component
        if (element.type === ScreenDataType.Text || element.type === ScreenDataType.Link) {
            const handleRendered = () => this._activateNextScreenData();
            return (
                <Teletype
                    key={key}
                    text={element.text}
                    onComplete={handleRendered}
                />
            );
        }

        if (element.type === ScreenDataType.Prompt) {
            const handleRendered = () => this._activateNextScreenData();
            return (
                <Teletype
                    key={key}
                    text={element.prompt}
                    onComplete={handleRendered}
                />
            );
        }

        return null;
    }

    // renders the final, interactive element to the screen
    private _renderStaticElement(element: any, key: number): ReactElement {
        const className = element.className || "";
        const handleRendered = () => {
            this._setElementState(element.id, ScreenDataState.Done);
        };

        if (element.type === ScreenDataType.Text) {
            // \0 is the ASCII null character to ensure empty lines aren't collapsed
            // https://en.wikipedia.org/wiki/Null_character
            const text = element.text.length ? element.text : "\0";
            return (
                <Text
                    key={key}
                    className={className}
                    text={text}
                    onRendered={handleRendered}
                />
            );
        }

        // link
        if (element.type === ScreenDataType.Link) {
            return (
                <Link
                    key={key}
                    text={element.text}
                    target={element.target}
                    className={className}
                    onClick={this._changeScreen}
                    onRendered={handleRendered}
                />
            );
        }

        // image
        if (element.type === ScreenDataType.Image) {
            return (
                <Image
                    key={key}
                    className={className}
                    src={element.src}
                    alt={element.alt}
                />
            );
        }

        // image
        if (element.type === ScreenDataType.Prompt) {
            return (
                <Prompt
                    key={key}
                    className={className}
                    disabled={!!this.state.activeDialogId}
                    prompt={element.prompt}
                    commands={element.commands}
                    onCommand={this._handleCommand}
                />
            );
        }

        return null;
    }

    private _changeScreen(targetScreen: string): void {
        // todo: handle missing screen
        // unload the current screen first
        this._unloadScreen();

        // active the first element in the screen's content collection
        const screen = this._getScreen(targetScreen);
        const activeElement = screen.content[0];
        activeElement.state = ScreenDataState.Active;

        this.setState({
            activeScreenId: targetScreen,
            activeElementId: activeElement.id,
            status: AppStatus.Active,
        });
    }

    private _setElementState(id: string, state: ScreenDataState): void {
        const screen = this._getScreen(this.state.activeScreenId);
        const content = screen.content.find(element => element.id === id);

        // only change the state if we need to
        if (content && (content.state !== state)) {
            content.state = state;
        }
;   }

    private _unloadScreen(): void {
        // go through the current screen elements, setting
        // their states to ScreenDataState.Ready
        const screen = this._getScreen(this.state.activeScreenId);
        screen.content.forEach(element => {
            element.state = ScreenDataState.Unloaded;
        });
    }

    private _getScreenDataById(id: string): any {
        const screen = this._getScreen(this.state.activeScreenId);
        return screen.content.find(element => element.id === id);
    }

    // find the currently active element and, if possible, activate it
    private _activateNextScreenData(): void {
        const screen = this._getScreen(this.state.activeScreenId);
        const activeIndex = screen.content.findIndex(element => element.state === ScreenDataState.Active);

        // nothing is active
        if (activeIndex === -1) {
            return;
        }

        // we're done with this element now
        screen.content[activeIndex].state = ScreenDataState.Done;

        // we're at the end of the array so there is no next
        if (activeIndex === screen.content.length - 1) {
            // todo: indicate everything's done
            this.setState({
                activeElementId: null,
                status: AppStatus.Done,
            });

            return;
        }

        // otherwise, activate the next one
        screen.content[activeIndex + 1].state = ScreenDataState.Active;

        // todo: indicate everything's done
        this.setState({
            activeElementId: screen.content[activeIndex + 1].id,
        });
    }

    private _getActiveScreenData(): ScreenData {
        const screen = this._getScreen(this.state.activeScreenId);
        const activeIndex = screen.content.findIndex(element => element.state === ScreenDataState.Active);

        // is something active?
        if (activeIndex > -1) {
            return screen.content[activeIndex];
        }

        // otherwise set & return the first element
        const firstData = screen.content[0];

        // unless that element is already done or not yet loaded
        if (firstData.state === ScreenDataState.Done || firstData.state === ScreenDataState.Unloaded) {
            return null;
        }


        firstData.state = ScreenDataState.Active;
        return firstData;
    }

    private _setActiveScreenDataByIndex(index: number): void {
        const screen = this._getScreen(this.state.activeScreenId);
        screen.content[index].state = ScreenDataState.Active;
    }

    private _toggleDialog(targetDialogId?: string): void {
        // TODO: check if targetDialog is a valid dialog
        this.setState({
            activeDialogId: targetDialogId || null,
        });
    }

    private _handleCommand(command: string, args?: any) {
        // handle the various commands
        if (!args || !args.type) {
            // display an error message
            return;
        }

        switch (args.type) {
            case "link":
                // fire the change screen event
                args.target && this._changeScreen(args.target);
                break;

            case "dialog":
                args.target && this._toggleDialog(args.target);
                break;

            case "console":
                console.log(command, args);
                break;

            default:
                // throw an error message
                break;
        }
    }

    private _renderDialog(): ReactElement {
        const { activeDialogId, dialogs, } = this.state;

        if (!activeDialogId) {
            return null;
        }

        const dialog = dialogs.find(element => element.id === activeDialogId);
        if (!dialog) {
            return null;
        }

        const handleClose = () => this._toggleDialog();

        return (
            <Modal
                text={dialog.content}
                onClose={handleClose}
            />
        );
    }
}

export default Phosphor;