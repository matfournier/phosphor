import React, { SFC, useEffect, useCallback } from "react";

export interface ModalProps {
    text: string | string[];
    className?: string;
    onClose: () => void;
}

const Modal: SFC<ModalProps> = (props) => {
    const { text, className, onClose } = props;
    const css = [
        "__modal__",
        className ? className : null,
    ].join(" ").trim();

    const renderContent = () => {
        const content = (typeof text === "string") ? [text] : text;
        return content.map((element, index) => <p key={index}>{element}</p>);
    }

    // add a keyhandler
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        e.preventDefault();

        const key = e.key.toLowerCase();

        switch (key) {
            case "enter":
            case "escape":
                onClose && onClose();
                break;

            default:
                break;
        }
    }, []);

    useEffect(() => {
        // mount
        document.addEventListener("keydown", handleKeyDown);

        // unmount
        return () => document.removeEventListener("keydown", handleKeyDown);
    });

    return (
        <section className={css} onClick={onClose}>
            <div className="content">
                {renderContent()}
            </div>
        </section>
    );
};

export default Modal;