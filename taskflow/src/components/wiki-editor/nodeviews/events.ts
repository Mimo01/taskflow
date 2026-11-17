/** Bubbling CustomEvent a raw-block node view fires to ask the shell to open source mode. */
export const EDIT_IN_SOURCE_EVENT = 'wikieditor:editsource';

export type EditInSourceDetail = { pos: number };

/** Bubbling CustomEvent dispatched from editor.view.dom by the slash menu to open the attachment picker. */
export const WIKI_OPEN_ATTACH_EVENT = 'wikieditor:openattach';
