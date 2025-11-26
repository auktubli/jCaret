/**
 * @class jCaret
 * @description A lightweight, fully featured, and customizable rich-text editor.
 * The editor is designed to be responsive and supports both LTR and RTL languages.
 * All static CSS is externalized to the <head> of the document.
 * Made With Love By: Jaber Bin Ayyash His Son Hamzah.
 */
class jCaret {
    /**
     * @constructor
     * @param {string} containerSelector The CSS selector for the editor's container element.
     * @param {object} [options={}] Configuration options for the editor.
     * @param {string} [options.width='800px'] The maximum width for the editor container.
     * @param {string} [options.height='400px'] The height or minimum height for the editor area.
     * @param {string} [options.heightMode='fixed'] 'fixed' for a set height, or 'min' for growing height.
     * @param {boolean} [options.useLocalStorage=false] Whether to save/load content using localStorage.
     * @param {string} [options.language='en'] The default language ('en' or 'ar'). **Defaults to 'en'.**
     * @param {string} [options.borderRadius='0'] The border radius for the editor container.
     */
    constructor(containerSelector, options = {}) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            throw new Error('Container not found');
        }
        // 1. Configuration and Defaults
        this.width = options.width || '800px';
        this.height = options.height || '400px';
        this.heightMode = options.heightMode || 'fixed';
        this.useLocalStorage = options.useLocalStorage || false;
        this.language = options.language || 'en'; // Default to 'en' if not specified
        this.dir = this.language === 'ar' ? 'rtl' : 'ltr';
        this.borderRadius = options.borderRadius || '0';
        // 2. Apply dynamic width options to container (overrides static CSS max-width)
        this.container.style.maxWidth = this.width;
        this.container.style.borderRadius = this.borderRadius;
        // Ensures centering works correctly
        this.container.style.margin = '0 auto';
        // 3. Set up translations and global direction
        this.i18n = {};
        this.setTranslations();
        document.documentElement.lang = this.language;
        document.documentElement.dir = this.dir;
        document.body.dir = this.dir;
        // 4. Append *DYNAMIC* CSS (only rules dependent on options: height, language/direction)
        this.appendDynamicStyles();

        // 5. Create toolbar (always LTR for UI purposes)
        this.toolbar = document.createElement('div');
        this.toolbar.id = 'toolbar';
        this.toolbar.className = 'bg-gray-50 border-b border-gray-300 p-3 flex flex-wrap gap-2 items-center justify-center';
        this.toolbar.dir = 'ltr';
        this.container.appendChild(this.toolbar);
        // Undo
        this.undoBtn = this.createButton({ command: 'undo', title: this.i18n.undo, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>' });
        this.toolbar.appendChild(this.undoBtn);
        // Redo
        this.redoBtn = this.createButton({ command: 'redo', title: this.i18n.redo, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"/></svg>' });
        this.toolbar.appendChild(this.redoBtn);
        // Divider
        this.toolbar.appendChild(this.createDivider());
        // Font Name
        this.fontNameContainer = this.createFontNameSelect();
        this.toolbar.appendChild(this.fontNameContainer);
        // Font Size
        this.fontSizeSelect = this.createFontSizeSelect();
        this.toolbar.appendChild(this.fontSizeSelect);
        // Divider
        this.toolbar.appendChild(this.createDivider());
        // Bold
        this.boldBtn = this.createButton({ command: 'bold', title: this.i18n.bold, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8.21 13c2.106 0 3.412-1.087 3.412-2.823 0-1.306-.984-2.283-2.324-2.386v-.055a2.176 2.176 0 0 0 1.852-2.14c0-1.51-1.162-2.46-3.014-2.46H3.843V13zM5.908 4.674h1.696c.963 0 1.517.451 1.517 1.244 0 .834-.629 1.32-1.73 1.32H5.908V4.673zm0 6.788V8.598h1.73c1.217 0 1.88.492 1.88 1.415 0 .943-.643 1.449-1.832 1.449H5.907z"/></svg>' });
        this.toolbar.appendChild(this.boldBtn);
        // Italic
        this.italicBtn = this.createButton({ command: 'italic', title: this.i18n.italic, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M7.991 11.674 9.53 4.455c.123-.595.246-.71 1.347-.807l.11-.52H7.211l-.11.52c1.06.096 1.128.212 1.005.807L6.57 11.674c-.123.595-.246.71-1.346.806l-.11.52h3.774l.11-.52c-1.06-.095-1.129-.211-1.006-.806z"/></svg>' });
        this.toolbar.appendChild(this.italicBtn);
        // Underline
        this.underlineBtn = this.createButton({ command: 'underline', title: this.i18n.underline, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.313 3.136h-1.23V9.54c0 2.105 1.47 3.475 3.69 3.475 2.213 0 3.692-1.37 3.692-3.475V3.136h-1.23v6.323c0 1.49-.978 2.57-2.457 2.57-1.495 0-2.465-1.089-2.465-2.57V3.136Zm-1.23 12.318h8.034v-1.147H3.083v1.147z"/></svg>' });
        this.toolbar.appendChild(this.underlineBtn);
        // Strikethrough
        this.strikethroughBtn = this.createButton({ command: 'strikethrough', title: this.i18n.strikethrough, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6.333 5.686c0 .31.083 .581.27 .814H5.166a2.776 2.776 0 0 1-.099-.76c0-1.627 1.436-2.768 3.48-2.768 1.969 0 3.39 1.175 3.445 2.85h-1.23c-.11-1.08-.964-1.743-2.25-1.743-1.23 0-2.18.602-2.18 1.607zm2.194 7.478c-2.153 0-3.589-1.107-3.705-2.81h1.23c.144 1.06 1.129 1.703 2.544 1.703 1.34 0 2.31-.705 2.31-1.675 0-.827-.547-1.374-1.914-1.675L8.046 8.5H1v-1h14v1h-3.504c.468.437.675.994.675 1.697 0 1.826-1.436 2.967-3.644 2.967z"/></svg>' });
        this.toolbar.appendChild(this.strikethroughBtn);
        // Superscript
        this.superscriptBtn = this.createButton({ command: 'superscript', title: this.i18n.superscript, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="1" y="20" font-size="20" fill="currentColor">x</text><text x="13" y="14" font-size="14" fill="currentColor">2</text></svg>' });
        this.toolbar.appendChild(this.superscriptBtn);
        // Subscript
        this.subscriptBtn = this.createButton({ command: 'subscript', title: this.i18n.subscript, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="1" y="14" font-size="20" fill="currentColor">x</text><text x="13" y="20" font-size="14" fill="currentColor">2</text></svg>' });
        this.toolbar.appendChild(this.subscriptBtn);
        // Blockquote
        this.blockquoteBtn = this.createButton({ command: 'insertBlockquote', title: this.i18n.blockquote, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>' });
        this.toolbar.appendChild(this.blockquoteBtn);
        // Highlight Container
        this.highlightContainer = document.createElement('div');
        this.highlightContainer.className = 'relative';
        this.toolbar.appendChild(this.highlightContainer);
        this.highlightButton = document.createElement('button');
        this.highlightButton.id = 'highlightButton';
        this.highlightButton.title = this.i18n.highlight;
        this.highlightButton.className = 'p-2 rounded-md hover:bg-gray-200';
        this.highlightButton.innerHTML = '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.477l1.392 1.392m-6.348 7.376l-1.392 1.392m-2.102-2.101l-1.392 1.392a3 3 0 00-4.243 0l-3.235-3.235a3 3 0 000-4.243l1.392-1.392m4.243-4.243l-1.392 1.392a3 3 0 000 4.243l3.235 3.235a3 3 0 004.243 0l1.392-1.392m-4.243-4.243l1.392 1.392a3 3 0 004.243 0l3.235-3.235a3 3 0 000 4.243l-1.392 1.392m-4.243-4.243l1.392 1.392a3 3 0 004.243 0l3.235-3.235a3 3 0 000 4.243l-1.392 1.392"/></svg><div id="highlightBar" style="display: block; height: 5px; background-color: white; margin-top: 0px; width: 100%; border-radius: 5px;" ></div>';
        this.highlightContainer.appendChild(this.highlightButton);
        this.highlightMenu = document.createElement('div');
        this.highlightMenu.id = 'highlightMenu';
        this.highlightMenu.className = 'hidden absolute top-full right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 flex flex-row';
        this.highlightMenu.innerHTML = `
            <button data-color="#FFFF00" class="w-5 h-5" style="background-color: #FFFF00;border-radius: 50px;" title="${this.i18n.yellow}"></button>
            <button data-color="#ADD8E6" class="w-5 h-5" style="background-color: #ADD8E6;border-radius: 50px;" title="${this.i18n.blue}"></button>
            <button data-color="#90EE90" class="w-5 h-5" style="background-color: #90EE90;border-radius: 50px;" title="${this.i18n.green}"></button>
            <button data-color="#FFC0CB" class="w-5 h-5" style="background-color: #FFC0CB;border-radius: 50px;" title="${this.i18n.pink}"></button>
            <button data-color="transparent" class="bg-transparent border-none text-gray-700 " style="border-radius: 5px;" title="${this.i18n.remove}">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
            </button>
        `;
        this.highlightContainer.appendChild(this.highlightMenu);
        // Font Color Container
        this.fontColorContainer = document.createElement('div');
        this.fontColorContainer.className = 'relative flex items-center';
        this.toolbar.appendChild(this.fontColorContainer);
        this.foreColorLabel = document.createElement('label');
        this.foreColorLabel.htmlFor = 'fontColorInput';
        this.foreColorLabel.title = this.i18n.fontColor;
        this.foreColorLabel.id = 'foreColorLabel';
        this.foreColorLabel.className = 'p-2 rounded-md hover:bg-gray-200 cursor-pointer';
        this.foreColorLabel.innerHTML = '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="12" y="16" font-size="16" fill="currentColor" text-anchor="middle">A</text></svg><div id="foreColorBar" style="display: block; height: 5px; background-color: #000000; margin-top: 0px; width: 100%; border-radius: 5px;"></div>';
        this.fontColorContainer.appendChild(this.foreColorLabel);
        this.fontColorInput = document.createElement('input');
        this.fontColorInput.type = 'color';
        this.fontColorInput.id = 'fontColorInput';
        this.fontColorInput.value = '#000000';
        this.fontColorContainer.appendChild(this.fontColorInput);
        // Remove Format
        this.toolbar.appendChild(this.createButton({ command: 'removeFormat', title: this.i18n.removeFormat, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' }));
        // Divider
        this.toolbar.appendChild(this.createDivider());
        // Create Link
        this.toolbar.appendChild(this.createButton({ command: 'createLink', title: this.i18n.createLink, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>' }));
        // Unlink
        this.toolbar.appendChild(this.createButton({ command: 'unlink', title: this.i18n.unlink, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
        // Divider
        this.toolbar.appendChild(this.createDivider());
        // Alignment Container
        this.alignmentContainer = document.createElement('div');
        this.alignmentContainer.className = 'relative';
        this.toolbar.appendChild(this.alignmentContainer);
        this.alignmentButton = document.createElement('button');
        this.alignmentButton.id = 'alignmentButton';
        this.alignmentButton.title = this.i18n.align;
        this.alignmentButton.className = 'p-2 rounded-md hover:bg-gray-200';
        this.alignmentButton.innerHTML = '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg>';
        this.alignmentContainer.appendChild(this.alignmentButton);
        this.alignmentMenu = document.createElement('div');
        this.alignmentMenu.id = 'alignmentMenu';
        this.alignmentMenu.className = 'hidden absolute top-full left-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 flex flex-col';
        this.alignmentContainer.appendChild(this.alignmentMenu);
        this.alignmentMenu.appendChild(this.createButton({ command: 'justifyLeft', title: this.i18n.alignLeft, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg>' }));
        this.alignmentMenu.appendChild(this.createButton({ command: 'justifyCenter', title: this.i18n.alignCenter, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M7.5 12h9M3.75 17.25h16.5"/></svg>' }));
        this.alignmentMenu.appendChild(this.createButton({ command: 'justifyRight', title: this.i18n.alignRight, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M7.5 12h12.75M3.75 17.25h16.5"/></svg>' }));
        this.alignmentMenu.appendChild(this.createButton({ command: 'justifyFull', title: this.i18n.alignJustify, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5M3.75 22.5h16.5"/></svg>' }));
        // Divider
        this.toolbar.appendChild(this.createDivider());
        // Unordered List
        this.toolbar.appendChild(this.createButton({ command: 'insertUnorderedList', title: this.i18n.unorderedList, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>' }));
        // Ordered List
        this.toolbar.appendChild(this.createButton({ command: 'insertOrderedList', title: this.i18n.orderedList, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6h9"/><path d="M11 12h9"/><path d="M12 18h8"/><path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4"/><path d="M6 10v-6l-2 2"/></svg>' }));
        // Divider
        this.toolbar.appendChild(this.createDivider());
        // Image Upload Button
        this.imageUploadButton = document.createElement('button');
        this.imageUploadButton.id = 'imageUploadButton';
        this.imageUploadButton.title = this.i18n.insertImage;
        this.imageUploadButton.className = 'p-2 rounded-md hover:bg-gray-200';
        this.imageUploadButton.innerHTML = '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>';
        this.toolbar.appendChild(this.imageUploadButton);
        this.imageUpload = document.createElement('input');
        this.imageUpload.type = 'file';
        this.imageUpload.id = 'imageUpload';
        this.imageUpload.accept = 'image/*';
        this.imageUpload.style.display = 'none';
        this.toolbar.appendChild(this.imageUpload);
        // Emoji Container
        this.emojiContainer = document.createElement('div');
        this.emojiContainer.className = 'relative';
        this.toolbar.appendChild(this.emojiContainer);
        this.emojiButton = document.createElement('button');
        this.emojiButton.id = 'emojiButton';
        this.emojiButton.title = this.i18n.insertEmoji;
        this.emojiButton.className = 'p-2 rounded-md hover:bg-gray-200';
        this.emojiButton.innerHTML = '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" /></svg>';
        this.emojiContainer.appendChild(this.emojiButton);
        this.emojiMenu = document.createElement('div');
        this.emojiMenu.id = 'emojiMenu';
        this.emojiMenu.style.minWidth = "190px";
        this.emojiMenu.className = 'hidden absolute top-full right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 grid grid-cols-5 p-2 gap-2';
        this.emojiContainer.appendChild(this.emojiMenu);
        const emojis = ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗'];
        emojis.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'text-2xl';
            btn.textContent = emoji;
            btn.dataset.emoji = emoji;
            this.emojiMenu.appendChild(btn);
        });
        // Insert Table
        this.insertTableBtn = this.createButton({ command: 'insertTable', title: this.i18n.insertTable, innerHTML: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>' });
        this.toolbar.appendChild(this.insertTableBtn);
        // Table Operations Container
        this.tableOpsContainer = document.createElement('div');
        this.tableOpsContainer.className = 'relative';
        this.toolbar.appendChild(this.tableOpsContainer);
        this.tableOperationsButton = document.createElement('button');
        this.tableOperationsButton.id = 'tableOperationsButton';
        this.tableOperationsButton.title = this.i18n.tableOperations;
        this.tableOperationsButton.className = 'p-2 rounded-md hover:bg-gray-200';
        this.tableOperationsButton.innerHTML = '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>';
        this.tableOpsContainer.appendChild(this.tableOperationsButton);
        this.tableMenu = document.createElement('div');
        this.tableMenu.id = 'tableMenu';
        this.tableMenu.className = 'hidden absolute top-full left-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 flex flex-col';
        this.tableOpsContainer.appendChild(this.tableMenu);
        this.tableMenu.appendChild(this.createButton({ command: 'insertRowAbove', title: this.i18n.insertRowAbove, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m-7.5-7.5h15" transform="rotate(180 12 12)"/></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'insertRowBelow', title: this.i18n.insertRowBelow, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m-7.5-7.5h15" /></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'insertColumnLeft', title: this.i18n.insertColLeft, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15m-7.5-7.5v15" transform="rotate(180 12 12)"/></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'insertColumnRight', title: this.i18n.insertColRight, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15m-7.5-7.5v15" /></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'deleteRow', title: this.i18n.deleteRow, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" /></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'deleteColumn', title: this.i18n.deleteCol, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16" /></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'deleteTable', title: this.i18n.deleteTable, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052 .682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059 .68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>' }));
        // Divider
        this.toolbar.appendChild(this.createDivider());
        // Clear All
        this.toolbar.appendChild(this.createButton({ command: 'clearAll', title: this.i18n.clearAll, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052 .682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059 .68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>' }));
        // Info
        this.toolbar.appendChild(this.createButton({ command: 'showInfo', title: this.i18n.infoTitle, innerHTML: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#000000" stroke-width="2"/><path d="M12 8H12.01" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12V16" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
        // 6. Editor Wrapper
        this.editorWrapper = document.createElement('div');
        this.container.appendChild(this.editorWrapper);

        // 7. Editor Core Area
        this.editor = document.createElement('div');
        this.editor.id = 'editor';
        this.editor.className = 'scroll-width-thin';
        this.editor.contentEditable = 'true';
        this.editor.spellcheck = false;
        this.editor.dir = this.dir;
        this.editorWrapper.appendChild(this.editor);
        // 8. Modals
        this.linkModal = this.createLinkModal();
        document.body.appendChild(this.linkModal);
        this.tableModal = this.createTableModal();
        document.body.appendChild(this.tableModal);
        this.storageModal = this.createStorageModal();
        document.body.appendChild(this.storageModal);
        this.infoModal = this.createInfoModal();
        document.body.appendChild(this.infoModal);
        this.selectModal = this.createSelectModal();
        document.body.appendChild(this.selectModal);

        // 9. State Initialization (Undo/Redo, Selection, etc.)
        this.currentHighlightColor = '#FFFF00';
        this.savedRange = null;
        this.selectedResizable = null;
        this.undoStack = [];
        this.redoStack = [];
        this.lastContent = '';
        this.editor.innerHTML = '<p><br></p>';
        if (this.useLocalStorage) {
            const savedContent = localStorage.getItem('jCaretContent');
            if (savedContent) {
                this.editor.innerHTML = savedContent;
            }
        }
        this.lastContent = this.editor.innerHTML;
        this.alignmentIcons = {
            justifyLeft: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg>',
            justifyCenter: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M7.5 12h9M3.75 17.25h16.5"/></svg>',
            justifyRight: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M7.5 12h12.75M3.75 17.25h16.5"/></svg>',
            justifyFull: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5M3.75 22.5h16.5"/></svg>'
        };
        this.isResizing = false;
        this.startX = 0;
        this.startWidth = 0;
        this.aspectRatio = null;
        this.currentResizable = null;
        this.resizeOldContent = '';
        this.hasShownStorageWarning = false;
        //this.updateDirections(); // Ensure directions and alignments are set after loading
        this.updateToolbarState(); // Update toolbar after loading

        // 10. Initialization
        this.addEventListeners();
        if(this.language === 'ar') this.updateDirections();
        // 11. Set initial editor direction and default font
        const defaultFont = this.language === 'ar' ? 'Amiri' : 'Inter';
        if (this.language === 'ar') {
            document.execCommand('justifyRight');
        } else {
            document.execCommand('justifyLeft');
        }
        document.execCommand('fontName', false, defaultFont);
        const opt = this.fontOptions.find(f => f.value === defaultFont);
        if (opt) {
            this.fontNameButton.firstChild.textContent = opt.label;
            this.fontNameValue = opt.value;
        }
        // Ensure default font is selected if query returns empty on initial load
        if (!this.fontNameValue) {
            const defaultOpt = this.fontOptions.find(f => f.value === defaultFont);
            if (defaultOpt) {
                this.fontNameButton.firstChild.textContent = defaultOpt.label;
                this.fontNameValue = defaultOpt.value;
            }
        }
        this.updateToolbarState();
        // Show the container after initialization for smooth rendering (explicitly in constructor)
        this.container.style.display = '';
    }
    /**
     * @method appendDynamicStyles
     * @description Creates and appends a style block for rules that depend on the constructor options (height, language).
     */
    appendDynamicStyles() {
        const style = document.createElement('style');
        style.id = 'jCaret-dynamic-style';

        let heightRules = '';
        if (this.heightMode === 'min') {
            // Min-height mode: allows the editor to grow
            heightRules = `
                min-height: ${this.height};
                height: auto;
                max-height: none;
            `;
        } else {
            // Fixed height mode (default): uses height and max-height
            heightRules = `
                height: ${this.height};
                max-height: ${this.height};
            `;
        }
        // Dynamic rules for RTL/LTR blockquote and list styling
        const langBorder = this.language === 'ar' ? 'right' : 'left';
        const oppLangBorder = this.language === 'ar' ? 'left' : 'right';
        const langPadding = this.language === 'ar' ? 'right' : 'left';
        const oppLangPadding = this.language === 'ar' ? 'left' : 'right';
        const langAlign = this.language === 'ar' ? 'right' : 'left';
        style.textContent = `
            /* Dynamic height rules based on heightMode option */
            #editor {
                ${heightRules}
                direction: ${this.dir};
                text-align: ${langAlign};
            }

            /* Dynamic blockquote rules based on language direction */
            #editor blockquote {
                border-${langBorder}: 4px solid #ddd;
                border-${oppLangBorder}: none;
                padding: 0 15px;
                color: #777;
                margin: 1em 0;
                position: relative;
                direction: ${this.dir};
            }
            #editor blockquote::before {
                content: "”";
                font-size: 4em;
                line-height: .1em;
                margin-${oppLangBorder}: .25em;
                vertical-align: -.4em;
                color: #ccc;
            }
            /* Dynamic list rules based on language direction */
            #editor ol[dir="${this.dir}"],
            #editor ul[dir="${this.dir}"] {
                padding-${langPadding}: 40px;
                padding-${oppLangPadding}: 0;
            }
            /* Dynamic table cell rules for direction and default alignment */
            #editor td {
                direction: initial;
                text-align: initial;
            }
            figcaption.caption{
                text-align: ${langAlign};
            }
        `;
        document.head.appendChild(style);
    }
    /**
     * @method setTranslations
     * @description Sets the translation object based on the configured language.
     * Includes English names for fonts in the 'en' version.
     */
    setTranslations() {
        const translations = {
            ar: {
                undo: 'تراجع', redo: 'إعادة', fontFamily: 'عائلة الخط',
                fontAmiri: 'أميري', fontNotoArabic: 'نوتو عربي', fontShekari: 'يد عربي', fontScheherazade: 'شهرزاد الجديدة',
                fontReemKufi: 'ريم كوفي', fontArefRuqaa: 'رقعة',
                fontElMessiri: 'المسيري',
                fontCairo: 'القاهرة', fontTajawal: 'تاجوال', fontLemonada: 'ليمونادا', fontMarhey: 'مرهي', fontKatibeh: 'كاتبة', fontHandjet: 'هاندجيت',
                fontSize: 'حجم الخط',
                size1: 'أصغر (حجم 1)', size2: 'صغير (حجم 2)', size3: 'عادي (حجم 3)',
                size4: 'كبير (حجم 4)', size5: 'أكبر (حجم 5)', size6: 'هائل (حجم 6)',
                size7: 'عملاق (حجم 7)',
                bold: 'غامق', italic: 'مائل',
                underline: 'تسطير', strikethrough: 'يتوسطه خط', superscript: 'أعلى',
                subscript: 'أسفل', blockquote: 'اقتباس', highlight: 'تمييز',
                yellow: 'أصفر', blue: 'أزرق', green: 'أخضر', pink: 'وردي',
                remove: 'إزالة', fontColor: 'لون الخط', removeFormat: 'إزالة التنسيق',
                createLink: 'إنشاء رابط', unlink: 'إزالة الرابط', align: 'محاذاة',
                alignLeft: 'محاذاة إلى اليسار', alignCenter: 'محاذاة إلى الوسط',
                alignRight: 'محاذاة إلى اليمين', alignJustify: 'محاذاة كاملة',
                unorderedList: 'قائمة غير مرتبة', orderedList: 'قائمة مرتبة',
                insertImage: 'إدراج صورة', insertTable: 'إدراج جدول', tableOperations: 'عمليات الجدول',
                insertRowAbove: 'إدراج صف أعلى', insertRowBelow: 'إدراج صف أسفل',
                insertColLeft: 'إدراج عمود يسار', insertColRight: 'إدراج عمود يمين',
                deleteRow: 'حذف الصف', deleteCol: 'حذف العمود', deleteTable: 'حذف الجدول',
                clearAll: 'مسح الكل', insertLink: 'أدخل الرابط', linkPlaceholder: 'https://example.com',
                cancel: 'إلغاء', save: 'حفظ', rows: 'الصفوف:', cols: 'الأعمدة:', infoTitle:'حول', infoText:'إختصارات لوحة المفاتيح', by:'لـ : جابر بن عيّاش إبنه حمزة.',
                clearAllConfirm: 'هل أنت متأكد من مسح كل المحتوى؟', maxColsAlert: 'الحد الأقصى 10 أعمدة', forQuote:'سطر إقتباس جديد', forEnlarge:'تكبير الخط على مستوى السطر', forShrink:'تصغير الخظ على مستوى السطر', forDelete:'حذف صورة أو جدول',
                caption: 'تسمية توضيحية',
                warning: 'تحذير',
                ok: 'موافق',
                storageWarning: 'حجم محتوى المحرر كبير جدًا، لذا لن يتم حفظ بعضه عند إعادة تحميل الصفحة في التخزين المحلي، خاصة الصور المرفوعة.',
                selectWarning: 'النص المحدد متعدد!.',
                insertEmoji: 'إدراج إيموجي'
            },
            en: {
                undo: 'Undo', redo: 'Redo', fontFamily: 'Font Family',
                // English font names for the English version
                fontInter: 'Inter', fontArial: 'Arial', fontTimes: 'Times New Roman',
                fontCourier: 'Courier New', fontGeorgia: 'Georgia', fontComic: 'Comic Sans MS',
                fontCaveat: 'Caveat', fontPacifico: 'Pacifico', fontDancingScript: 'Dancing Script',
                fontIndieFlower: 'Indie Flower', fontShadowsIntoLight: 'Shadows Into Light',
                fontHandjet: 'Handjet',
                fontSize: 'Font Size',
                size1: 'Smallest (Size 1)', size2: 'Small (Size 2)', size3: 'Normal (Size 3)',
                size4: 'Large (Size 4)', size5: 'Larger (Size 5)', size6: 'Huge (Size 6)',
                size7: 'Largest (Size 7)',
                bold: 'Bold', italic: 'Italic',
                underline: 'Underline', strikethrough: 'Strikethrough', superscript: 'Superscript',
                subscript: 'Subscript', blockquote: 'Blockquote', highlight: 'Highlight',
                yellow: 'Yellow', blue: 'Blue', green: 'Green', pink: 'Pink',
                remove: 'Remove', fontColor: 'Font Color', removeFormat: 'Remove Format',
                createLink: 'Create Link', unlink: 'Unlink', align: 'Align',
                alignLeft: 'Align Left', alignCenter: 'Align Center',
                alignRight: 'Align Right', alignJustify: 'Align Justify',
                unorderedList: 'Unordered List', orderedList: 'Ordered List',
                insertImage: 'Insert Image', insertTable: 'Insert Table', tableOperations: 'Table Operations',
                insertRowAbove: 'Insert Row Above', insertRowBelow: 'Insert Row Below',
                insertColLeft: 'Insert Column Left', insertColRight: 'Insert Column Right',
                deleteRow: 'Delete Row', deleteCol: 'Delete Column', deleteTable: 'Delete Table',
                clearAll: 'Clear All', insertLink: 'Enter Link', linkPlaceholder: 'https://example.com',
                cancel: 'Cancel', save: 'Save', rows: 'Rows:', cols: 'Columns:', infoTitle:'About',infoText:'Keyboard Shortcuts', by:'For : Jaber bin Ayyash His Son Hamzah.',
                clearAllConfirm: 'Are you sure you want to clear all content?', maxColsAlert: 'Maximum of 10 columns allowed', forQuote:'New quote line', forEnlarge:'Enlarge text font (line level)', forShrink:'Shrink text font (line level)', forDelete:'Remove image or table',
                caption: 'Caption',
                warning: 'Warning',
                ok: 'OK',
                storageWarning: 'The content of the editor is too big, so some of it won\'t be saved on page reload in local storage, especially uploaded images.',
                selectWarning: 'Multi Selected!.',
                insertEmoji: 'Insert Emoji'
            }
        };
        this.i18n = translations[this.language] || translations.en;
    }

    /**
        * @method createDivider
        * @description Creates a vertical separator for the toolbar.
        */
    createDivider() {
        const div = document.createElement('div');
        div.className = 'h-6 w-px bg-gray-300 mx-1';
        return div;
    }
    /**
        * @method createButton
        * @description Creates a standard toolbar button.
        */
    createButton(attrs = {}) {
        const button = document.createElement('button');
        button.className = 'p-2 rounded-md hover:bg-gray-200';
        if (attrs.title) button.title = attrs.title;
        if (attrs.command) button.dataset.command = attrs.command;
        if (attrs.innerHTML) button.innerHTML = attrs.innerHTML;
        return button;
    }
    /**
        * @method createFontNameSelect
        * @description Creates the Font Family selection dropdown as a custom component for scrollability.
        * Uses translated font names for display text.
        */
    createFontNameSelect() {
        const container = document.createElement('div');
        container.className = 'relative';
        container.id = 'fontName';
        container.dir = this.dir;
        const button = document.createElement('button');
        button.className = 'p-2 border border-gray-300 rounded-md text-sm flex items-center justify-between w-full';
        button.style.height = '2.5rem';
        button.style.maxWidth = "140px";
        button.style.minWidth = "140px";
        button.innerHTML = `${this.i18n.fontFamily}<svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;
        const menu = document.createElement('ul');
        menu.className = 'hidden absolute top-full left-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 overflow-y-auto';
        menu.style.width = '100%';
        menu.style.maxHeight = '270px';
        container.appendChild(button);
        container.appendChild(menu);
        let fonts = [];
        if (this.language === 'ar') {
            fonts = [
                {value: 'Amiri', label: this.i18n.fontAmiri},
                {value: 'Noto Sans Arabic', label: this.i18n.fontNotoArabic},
                {value: 'Scheherazade New', label: this.i18n.fontScheherazade},
                {value: 'Reem Kufi', label: this.i18n.fontReemKufi},
                {value: 'Aref Ruqaa', label: this.i18n.fontArefRuqaa},
                {value: 'El Messiri', label: this.i18n.fontElMessiri},
                {value: 'Cairo', label: this.i18n.fontCairo},
                {value: 'Tajawal', label: this.i18n.fontTajawal},
                {value: 'Lemonada', label: this.i18n.fontLemonada},
                {value: 'Marhey', label: this.i18n.fontMarhey},
                {value: 'Katibeh', label: this.i18n.fontKatibeh},
                {value: 'Handjet', label: this.i18n.fontHandjet},
                {value: 'Shekari', label: this.i18n.fontShekari} // additional handwritten
            ];
        } else {
            fonts = [
                {value: 'Inter', label: this.i18n.fontInter},
                {value: 'Arial', label: this.i18n.fontArial},
                {value: 'Times New Roman', label: this.i18n.fontTimes},
                {value: 'Courier New', label: this.i18n.fontCourier},
                {value: 'Georgia', label: this.i18n.fontGeorgia},
                {value: 'Comic Sans MS', label: this.i18n.fontComic},
                {value: 'Caveat', label: this.i18n.fontCaveat},
                {value: 'Pacifico', label: this.i18n.fontPacifico},
                {value: 'Dancing Script', label: this.i18n.fontDancingScript},
                {value: 'Indie Flower', label: this.i18n.fontIndieFlower},
                {value: 'Shadows Into Light', label: this.i18n.fontShadowsIntoLight},
                {value: 'Handjet', label: this.i18n.fontHandjet}
            ];
        }
        this.fontOptions = fonts;
        fonts.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f.label;
            li.style.fontFamily = f.value;
            li.style.padding = '8px 16px';
            li.style.cursor = 'pointer';
            li.dataset.value = f.value;
            li.addEventListener('click', () => {
                button.firstChild.textContent = f.label;
                this.fontNameValue = f.value;
                menu.classList.add('hidden');
                const event = new Event('change');
                container.dispatchEvent(event);
            });
            menu.appendChild(li);
        });
        button.addEventListener('click', (e) => {
            e.preventDefault();
            menu.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });
        this.fontNameButton = button;
        this.fontNameValue = '';
        return container;
    }
    /**
        * @method createFontSizeSelect
        * @description Creates the Font Size selection dropdown.
        */
    createFontSizeSelect() {
        const select = document.createElement('select');
        select.id = 'fontSize';
        select.style.height = "2.5rem";
        select.className = 'p-2 border border-gray-300 rounded-md text-sm';
        //select.style.fontFamily = "sans-serif";
    
        select.dir = this.dir;
        select.innerHTML = `
            <option value="">${this.i18n.fontSize}</option>
            <option value="1">${this.i18n.size1}</option>
            <option value="2">${this.i18n.size2}</option>
            <option value="3">${this.i18n.size3}</option>
            <option value="4">${this.i18n.size4}</option>
            <option value="5">${this.i18n.size5}</option>
            <option value="6">${this.i18n.size6}</option>
            <option value="7">${this.i18n.size7}</option>
        `;
        return select;
    }
    /**
        * @method createLinkModal
        * @description Creates the modal dialog for inserting links.
        */
    createLinkModal() {
        const div = document.createElement('div');
        div.id = 'linkModal';
        div.className = 'hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
        div.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" dir="${this.dir}">
                <h3 class="text-lg font-medium mb-4">${this.i18n.insertLink}</h3>
                <input type="text" dir="ltr" id="linkUrl" class="border border-gray-300 rounded-md w-full p-2 mb-4" placeholder="${this.i18n.linkPlaceholder}">
                <div class="flex justify-end gap-2">
                    <button id="cancelLink" class="px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100">${this.i18n.cancel}</button>
                    <button id="saveLink" class="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">${this.i18n.save}</button>
                </div>
            </div>
        `;
        return div;
    }
    /**
        * @method createTableModal
        * @description Creates the modal dialog for inserting tables.
        */
    createTableModal() {
        const div = document.createElement('div');
        div.id = 'tableModal';
        div.className = 'hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
        div.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" dir="${this.dir}">
                <h3 class="text-lg font-medium mb-4">${this.i18n.insertTable}</h3>
                <label for="rowsInput">${this.i18n.rows}</label>
                <input type="number" id="rowsInput" min="1" class="border border-gray-300 rounded-md w-full p-2 mb-4" value="3">
                <label for="colsInput">${this.i18n.cols}</label>
                <input type="number" id="colsInput" min="1" max="10" class="border border-gray-300 rounded-md w-full p-2 mb-4" value="3">
                <div class="flex justify-end gap-2">
                    <button id="cancelTable" class="px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100">${this.i18n.cancel}</button>
                    <button id="saveTable" class="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">${this.i18n.save}</button>
                </div>
            </div>
        `;
        return div;
    }
    /**
        * @method createStorageModal
        * @description Creates the modal dialog for storage warning.
        */
    createStorageModal() {
        const div = document.createElement('div');
        div.id = 'storageModal';
        div.className = 'hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
        div.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" dir="${this.dir}">
                <h3 class="text-lg font-medium mb-4">${this.i18n.warning}</h3>
                <p>${this.i18n.storageWarning}</p>
                <div class="flex justify-end gap-2 mt-4">
                    <button id="closeStorage" class="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">${this.i18n.ok}</button>
                </div>
            </div>
        `;
        return div;
    }
    /**
        * @method createAboutModal
        * @description Creates the modal dialog for about info.
        */
    createInfoModal() {
        const div = document.createElement('div');
        div.id = 'infoModal';
        div.className = 'hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
        div.innerHTML = `
        
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" dir="${this.dir}">
            
                <div class="flex items-center gap-3">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <h3 class="text-lg font-medium ">${this.i18n.infoTitle}</h3>
                </div>
                <br/>
                <div id="aboutText" class="flex items-center gap-3 mb-5 border-b pb-3 border-gray-300">
                    <h3 class="text-lg font-medium text-gray-800">${this.i18n.infoText}</h3>
                </div>
                <div id="aboutContent" class="space-y-3 text-sm">
                
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">${this.i18n.forQuote}</span>
                        <div class="flex items-center gap-1" dir="ltr">
                            <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-sans text-gray-500 font-semibold shadow-sm">Shift</kbd>
                            <span class="text-gray-400 text-xs">+</span>
                            <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-sans text-gray-500 font-semibold shadow-sm">Enter</kbd>
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">${this.i18n.forEnlarge}</span>
                        <div class="flex items-center gap-1" dir="ltr">
                            <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-sans text-gray-500 font-semibold shadow-sm">Ctrl</kbd>
                            <span class="text-gray-400 text-xs">+</span>
                            <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-sans text-gray-500 font-semibold shadow-sm">+</kbd>
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">${this.i18n.forShrink}</span>
                        <div class="flex items-center gap-1" dir="ltr">
                            <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-sans text-gray-500 font-semibold shadow-sm">Ctrl</kbd>
                            <span class="text-gray-400 text-xs">+</span>
                            <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-sans text-gray-500 font-semibold shadow-sm">-</kbd>
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">${this.i18n.forDelete}</span>
                        <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-sans text-gray-500 font-semibold shadow-sm">Delete</kbd>
                    </div>
                </div>
                <div class="flex justify-between gap-2 mt-6 pt-4 border-t border-gray-100">
                    <p style="margin-top: 10px;">${this.i18n.by}</p><button id="closeInfo" class="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">${this.i18n.ok || 'OK'}</button>
                </div>
            </div>
        `;
        return div;
    }
    /**
        * @method createMultiSizeModal
        * @description Creates the modal dialog for multi size selected text warning.
        */
    createSelectModal() {
        const div = document.createElement('div');
        div.id = 'selectModal';
        div.className = 'hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
        div.innerHTML = `
            <div style="background-color: #dfedec;" class="rounded-lg shadow-xl p-6 w-full max-w-sm" dir="${this.dir}">
                <h3 class="text-lg font-medium mb-4">${this.i18n.warning}</h3>
                <p>${this.i18n.selectWarning}</p>
                <div class="flex justify-end gap-2 mt-4">
                    <button id="closeSelect" class="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">${this.i18n.ok}</button>
                </div>
            </div>
        `;
        return div;
    }
        /**
        * @method getCurrentBlockElement
        * @description Returns current element where caret is.
        */
    getCurrentBlockElement() {
            const selection = window.getSelection();
            
            // 1. Safety check: Is anything selected?
            if (!selection.rangeCount) return null;
            // 2. Get the node where the selection starts
            let node = selection.anchorNode;
            // 3. Text Node Fix:
            // If the node is text (nodeType 3), get its parent element.
            // Example: <p>Hello|</p> -> node is "Hello", parent is <p>
            if (node.nodeType === 3) {
                node = node.parentNode;
            }
            // 4. Check for the "Root" (Nothing) case
            // If the resulting node is the contenteditable div itself,
            // it means the text is not wrapped in a p or div.
            if (node.getAttribute('contenteditable') === 'true') {
                return 'ROOT';
            }
            // 5. Return the Tag Name (e.g., 'P', 'DIV', 'LI')
            return node.tagName;
        }
    /**
        * @method getNextBlockElement
        * @description Returns next line element where caret is.
        */
    getNextBlockElement() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        // 1. Get the node where the caret is
        let currentNode = selection.anchorNode;
        // 2. Define your editor container (update ID as needed)
        const editor = document.getElementById('editor');
        // Safety check: Ensure selection is actually inside the editor
        if (!editor.contains(currentNode)) return null;
        // 3. Traverse UP to find the immediate child of the editor
        // We want the top-level block (the P or DIV), not the <b> or <i> inside it.
        while (currentNode && currentNode.parentNode !== editor) {
            currentNode = currentNode.parentNode;
        }
        // 4. Now currentNode is the block (e.g., <p> or <div>).
        // Get the next sibling element.
        const nextElement = currentNode.nextElementSibling;
        if (nextElement) {
            return nextElement.tagName; // Returns 'DIV', 'P', 'UL', etc.
        } else {
            return 'NOTHING'; // It is the last element in the editor
        }
    }
    /**
        * @method addEventListeners
        * @description Initializes all event listeners for the toolbar, editor, and modals.
        */
    addEventListeners() {
        this.alignmentButton.addEventListener('click', e => {
            e.preventDefault();
            this.alignmentMenu.classList.toggle('hidden');
        });
        this.emojiButton.addEventListener('click', e => {
            e.preventDefault();
            this.emojiMenu.classList.toggle('hidden');
        });
        document.addEventListener('click', e => {
            if (!this.alignmentButton.contains(e.target) && !this.alignmentMenu.contains(e.target)) {
                this.alignmentMenu.classList.add('hidden');
            }
            if (!this.highlightButton.contains(e.target) && !this.highlightMenu.contains(e.target)) {
                this.highlightMenu.classList.add('hidden');
            }
            if (!this.tableOperationsButton.contains(e.target) && !this.tableMenu.contains(e.target)) {
                this.tableMenu.classList.add('hidden');
            }
            if (!this.emojiButton.contains(e.target) && !this.emojiMenu.contains(e.target)) {
                this.emojiMenu.classList.add('hidden');
            }
        });
        this.highlightButton.addEventListener('click', e => {
            e.preventDefault();
            this.highlightMenu.classList.toggle('hidden');
        });
        this.highlightButton.addEventListener('mousedown', e => {
            e.preventDefault();
            this.saveSelection();
        });
        this.highlightMenu.addEventListener('click', e => {
            const btn = e.target.closest('button[data-color]');
            if (btn) {
                this.currentHighlightColor = btn.dataset.color;
                const highlightBar = this.highlightContainer.querySelector('#highlightBar');
                highlightBar.style.backgroundColor = this.currentHighlightColor === 'transparent' ? 'transparent' : this.currentHighlightColor;
                this.highlightMenu.classList.add('hidden');
                this.editor.focus();
                this.restoreSelection();
                document.execCommand('backColor', false, this.currentHighlightColor);
            }
        });
        this.emojiMenu.addEventListener('click', e => {
            const btn = e.target.closest('button[data-emoji]');
            if (btn) {
                this.emojiMenu.classList.add('hidden');
                this.editor.focus();
                document.execCommand('insertText', false, btn.dataset.emoji);
            }
        });
        this.tableOperationsButton.addEventListener('click', e => {
            e.preventDefault();
            this.tableMenu.classList.toggle('hidden');
            if (!this.tableMenu.classList.contains('hidden')) {
                this.updateTableMenu();
            }
        });
        this.imageUploadButton.addEventListener('click', e => {
            e.preventDefault();
            this.saveSelection();
            this.imageUpload.click();
        });
        this.imageUpload.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const oldContent = this.editor.innerHTML;
            const reader = new FileReader();
            reader.onload = ev => {
                const figure = document.createElement('figure');
                figure.className = 'resizable center';
                figure.contentEditable = 'false';
                figure.id = 'temp-new-image';
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.alt = 'Uploaded Image';
                img.style.display = 'block';
                img.style.width = '100%';
                img.style.height = 'auto';
                figure.appendChild(img);
                const figcaption = document.createElement('figcaption');
                figcaption.className = 'caption';
                figcaption.contentEditable = 'true';
                figcaption.textContent = this.i18n.caption; // Use translation
                figure.appendChild(figcaption);
                this.editor.focus();
                this.restoreSelection();
                document.execCommand('insertHTML', false, figure.outerHTML);
                const newFigure = this.editor.querySelector('#temp-new-image');
                document.querySelector('button[data-command="justifyFull"]').style.display = "none";
                if (newFigure) {
                    newFigure.removeAttribute('id');
                    this.addResizeHandle(newFigure);
                    this.selectedResizable = newFigure;
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    newFigure.parentNode.insertBefore(p, newFigure.nextSibling);
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                if (this.editor.innerHTML !== oldContent) {
                    this.undoStack.push(oldContent);
                    this.redoStack = [];
                    this.lastContent = this.editor.innerHTML;
                    this.saveAll();
                }
                this.updateToolbarState();
                this.imageUpload.value = '';
            };
            reader.readAsDataURL(file);
        });
        this.fontNameContainer.addEventListener('mousedown', () => this.saveSelection());
        this.fontNameContainer.addEventListener('change', () => {
            const oldContent = this.editor.innerHTML;
            if (this.fontNameValue) {
                this.editor.focus();
                this.restoreSelection();
                document.execCommand('fontName', false, this.fontNameValue);
                if (this.editor.innerHTML !== oldContent) {
                    this.undoStack.push(oldContent);
                    this.redoStack = [];
                    this.lastContent = this.editor.innerHTML;
                    this.saveAll();
                }
                this.updateToolbarState();
            }
        });
        this.fontSizeSelect.addEventListener('mousedown', () => this.saveSelection());
        this.fontSizeSelect.addEventListener('change', () => {
            const oldContent = this.editor.innerHTML;
            if (this.fontSizeSelect.value) {
                this.editor.focus();
                this.restoreSelection();
                const value = this.fontSizeSelect.value;
                // Changed: Only execCommand for values 1-7; for 7, only apply style (no execCommand, as it's invalid)
                if (value <= 7) {
                    document.execCommand('fontSize', false, value);
                }
                if (this.editor.innerHTML !== oldContent) {
                    this.undoStack.push(oldContent);
                    this.redoStack = [];
                    this.lastContent = this.editor.innerHTML;
                    this.saveAll();
                }
                this.updateToolbarState();
            }
        });
        
        this.foreColorLabel.addEventListener('mousedown', () => this.saveSelection());
        this.fontColorInput.addEventListener('mousedown', () => this.saveSelection());
        this.fontColorInput.addEventListener('change', e => {
            this.editor.focus();
            this.restoreSelection();
            const wasSelected = !window.getSelection().isCollapsed;
            document.execCommand('foreColor', false, e.target.value);
            if (wasSelected) {
                const sel = window.getSelection();
                sel.collapseToEnd();
                document.execCommand('foreColor', false, e.target.value);
            }
            this.updateToolbarState();
        });
        this.toolbar.addEventListener('mousedown', e => {
            let target = e.target;
            if (target.nodeType === Node.TEXT_NODE) target = target.parentElement;
            const btn = target.closest('button[data-command]');
            if (btn && target.closest('#toolbar')) {
                e.preventDefault();
                this.saveSelection();
            }
        });
        this.toolbar.addEventListener('click', e => {
            let target = e.target;
            if (target.nodeType === Node.TEXT_NODE) target = target.parentElement;
            const btn = target.closest('button');
            if (!btn || !btn.dataset.command) return;
            e.preventDefault();
            const cmd = btn.dataset.command;
            const val = btn.dataset.value || null;
            this.editor.focus();
            this.restoreSelection();
            const oldContent = this.editor.innerHTML;
            let changed = false;
            if (cmd === 'showInfo'){
                this.infoModal.classList.remove("hidden");
            } else if (cmd === 'undo') {
                if (this.undoStack.length > 0) {
                    this.redoStack.push(this.editor.innerHTML);
                    this.editor.innerHTML = this.undoStack.pop();
                    this.lastContent = this.editor.innerHTML;
                    this.saveAll();
                    changed = true;
                }
            } else if (cmd === 'redo') {
                if (this.redoStack.length > 0) {
                    this.undoStack.push(this.editor.innerHTML);
                    this.editor.innerHTML = this.redoStack.pop();
                    this.lastContent = this.editor.innerHTML;
                    this.saveAll();
                    changed = true;
                }
            } else if (cmd === 'backColor') {
                const cur = document.queryCommandValue('backColor').toLowerCase();
                const on = (cur === 'rgb(255, 255, 0)' || cur === '#ffff00');
                document.execCommand(cmd, false, on ? 'transparent' : val);
                changed = true;
            } else if (cmd === 'clearAll') {
                if (confirm(this.i18n.clearAllConfirm)) { // Use translation
                    this.undoStack.push(oldContent);
                    this.redoStack = [];
                    this.editor.innerHTML = '<p><br></p>';
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.setStart(this.editor.firstChild, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    this.resetEditorStyles();
                    this.lastContent = this.editor.innerHTML;
                    this.saveAll();
                    changed = true;
                }
            } else if (cmd === 'createLink') {
                if (this.savedRange && this.savedRange.toString().length) {
                    this.linkModal.classList.remove('hidden');
                    this.linkModal.querySelector('#linkUrl').value = 'https://';
                    this.linkModal.querySelector('#linkUrl').focus();
                }
            } else if (cmd === 'insertBlockquote') {
                const sel = window.getSelection();
                if (!sel.rangeCount) return;
                const range = sel.getRangeAt(0);
                let container = range.commonAncestorContainer;
                while (container && container.nodeType !== Node.ELEMENT_NODE) {
                    container = container.parentNode;
                }
                const blockquote = container.closest('blockquote');
                if (blockquote) {
                    const fragment = document.createDocumentFragment();
                    while (blockquote.firstChild) {
                        fragment.appendChild(blockquote.firstChild);
                    }
                    blockquote.parentNode.replaceChild(fragment, blockquote);
                    const firstChild = fragment.firstChild;
                    if (firstChild) {
                        const newRange = document.createRange();
                        newRange.selectNodeContents(firstChild);
                        newRange.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                    }
                } else {
                    const fragment = range.extractContents();
                    const contentText = fragment.textContent.trim();
                    if (!contentText) return;
                    const dir = /[\u0600-\u06FF\u0750-\u077F]/.test(contentText) ? 'rtl' : 'ltr';
                    const p = document.createElement('p');
                    p.dir = dir;
                    p.appendChild(fragment);
                    const bq = document.createElement('blockquote');
                    bq.appendChild(p);
                    range.insertNode(bq);
                    const newRange = document.createRange();
                    newRange.selectNodeContents(p);
                    newRange.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
                this.updateDirections();
                this.updateToolbarState();
                changed = true;
            } else if (cmd === 'insertUnorderedList' || cmd === 'insertOrderedList') {
                let currentDir = this.dir; // default to editor's dir
                const sel = window.getSelection();
                if (sel.rangeCount) {
                let container = sel.getRangeAt(0).commonAncestorContainer;
                if (container.nodeType !== 1) container = container.parentElement;
                const block = container.closest('p, blockquote, ol, ul, li, td');
                if (block) {
                    const style = window.getComputedStyle(block);
                    const textAlign = style.textAlign;
                    const direction = style.direction;
                    let effectiveAlign;
                    if (textAlign === 'left' || textAlign === 'right') {
                        effectiveAlign = textAlign;
                    } else if (textAlign === 'start') {
                        effectiveAlign = direction === 'ltr' ? 'left' : 'right';
                    } else if (textAlign === 'end') {
                        effectiveAlign = direction === 'ltr' ? 'right' : 'left';
                    } else {
                    // For center, justify, etc., use current direction without changing
                        currentDir = direction;
                    }
                    if (effectiveAlign === 'left') {
                        currentDir = 'ltr';
                    } else if (effectiveAlign === 'right') {
                        currentDir = 'rtl';
                    }
                    
                    if(this.language === "en" && ((currentDir === "rtl" || direction === "rtl"))){      
                        return;
                    }
                    }
                }
                //const cr = this.getCurrentBlockElement();
                document.execCommand(cmd, false, null);
                if (sel.rangeCount) {
                let li = sel.getRangeAt(0).commonAncestorContainer;
                while (li && li.nodeName !== 'LI') {
                    if (li.nodeType !== 1) li = li.parentElement;
                    else break;
                }
                if (li && li.nodeName === 'LI') {
                    // Set direction on the parent list (ul or ol) to support RTL lists
                    let list = li.parentElement;
                    if (list && (list.nodeName === 'UL' || list.nodeName === 'OL')) {
                    list.dir = currentDir;
                    }
                    const tempChar = currentDir === 'rtl' ? 'ا' : 'a';
                    const tempText = document.createTextNode(tempChar);
                    li.insertBefore(tempText, li.firstChild);
                    //this.updateDirections();
                    tempText.remove();
                    if (li.innerHTML === '') li.innerHTML = '<br>';
                }
                }
                
                if(this.language === 'ar') this.updateDirections();
                changed = true;
            } else if (['justifyLeft','justifyCenter','justifyRight','justifyFull'].includes(cmd)) {
                this.alignmentMenu.classList.add('hidden');
                const sel = window.getSelection();
                if (sel.rangeCount) {
                    let container = sel.getRangeAt(0).commonAncestorContainer;
                    if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
                    const td = container.closest('td');
                    if (td) {
                        if (sel.isCollapsed) {
                            // Apply to table alignment
                            this.selectedResizable = td.closest('.resizable');
                            if (this.selectedResizable) {
                                const wasFull = this.selectedResizable.classList.contains('full');
                                const willBeFull = cmd === 'justifyFull';
                                if (!wasFull && willBeFull) {
                                    const currentWidth = this.selectedResizable.style.width || getComputedStyle(this.selectedResizable).width;
                                    this.selectedResizable.setAttribute('data-resize-width', currentWidth);
                                }
                                this.selectedResizable.classList.remove('left', 'center', 'right', 'full');
                                if (cmd === 'justifyLeft') {this.selectedResizable.classList.add('right');td.focus();}
                                else if (cmd === 'justifyCenter') {this.selectedResizable.classList.add('center');}
                                else if (cmd === 'justifyRight') {this.selectedResizable.classList.add('left');}
                                else if (cmd === 'justifyFull') { this.selectedResizable.classList.add('full');}
                                if (willBeFull) {
                                    this.selectedResizable.style.width = '100%';
                                } else if (wasFull && !willBeFull) {
                                    const storedWidth = this.selectedResizable.getAttribute('data-resize-width');
                                    if (storedWidth) {
                                        this.selectedResizable.style.width = storedWidth;
                                    } else {
                                        this.selectedResizable.style.width = '';
                                    }
                                }
                                
                                this.removeResizeHandles(this.selectedResizable);
                                this.addResizeHandle(this.selectedResizable);
                                changed = true;
                                this.undoStack.push(oldContent);
                                this.redoStack = [];
                                this.lastContent = this.editor.innerHTML;
                                this.saveAll();
                            }
                        } else {
                            // Apply to selected content in cell
                            document.execCommand(cmd, false, null);
                            changed = true;
                        }
                        this.updateToolbarState();
                        return;
                    }
                }
                if (this.selectedResizable) {
                    const wasFull = this.selectedResizable.classList.contains('full');
                    const willBeFull = cmd === 'justifyFull';
                    if (!wasFull && willBeFull) {
                        const currentWidth = this.selectedResizable.style.width || getComputedStyle(this.selectedResizable).width;
                        this.selectedResizable.setAttribute('data-resize-width', currentWidth);
                    }
                    this.selectedResizable.classList.remove('left', 'center', 'right', 'full');
                    if (cmd === 'justifyLeft') this.selectedResizable.classList.add('right');
                    else if (cmd === 'justifyCenter') this.selectedResizable.classList.add('center');
                    else if (cmd === 'justifyRight') this.selectedResizable.classList.add('left');
                    else if (cmd === 'justifyFull') this.selectedResizable.classList.add('full');
                    if (willBeFull) {
                        this.selectedResizable.style.width = '100%';
                    } else if (wasFull && !willBeFull) {
                        const storedWidth = this.selectedResizable.getAttribute('data-resize-width');
                        if (storedWidth) {
                            this.selectedResizable.style.width = storedWidth;
                        } else {
                            this.selectedResizable.style.width = '';
                        }
                    }
                    this.removeResizeHandles(this.selectedResizable);
                    this.addResizeHandle(this.selectedResizable);
                    changed = true;
                } else {
                    document.execCommand(cmd, false, null);
                    changed = true;
                }
            } else if (cmd === 'insertTable') {
                this.saveSelection();
                this.tableModal.classList.remove('hidden');
                this.tableModal.querySelector('#rowsInput').value = '3';
                this.tableModal.querySelector('#colsInput').value = '3';
                this.tableModal.querySelector('#rowsInput').focus();
            } else if (cmd === 'insertRowAbove' || cmd === 'insertRowBelow' || cmd === 'insertColumnLeft' || cmd === 'insertColumnRight' || cmd === 'deleteTable' || cmd === 'deleteRow' || cmd === 'deleteColumn') {
                this.tableMenu.classList.add('hidden');
                const sel = window.getSelection();
                if (!sel.rangeCount) return;
                let node = sel.anchorNode;
                while (node && node.nodeName !== 'TD') node = node.parentNode;
                if (!node) {
                    if (cmd === 'deleteTable' && this.selectedResizable && this.selectedResizable.querySelector('table')) {
                        this.selectedResizable.remove();
                        this.selectedResizable = null;
                        changed = true;
                    }
                    return;
                }
                const tr = node.parentNode;
                const table = tr.parentNode;
                const colIndex = node.cellIndex;
                if (cmd === 'insertRowAbove') {
                    const newTr = tr.cloneNode(true);
                    Array.from(newTr.children).forEach(td => td.innerHTML = '<br>');
                    tr.before(newTr);
                    changed = true;
                } else if (cmd === 'insertRowBelow') {
                    const newTr = tr.cloneNode(true);
                    Array.from(newTr.children).forEach(td => td.innerHTML = '<br>');
                    tr.after(newTr);
                    changed = true;
                } else if (cmd === 'insertColumnLeft' || cmd === 'insertColumnRight') {
                    const rows = table.querySelectorAll('tr');
                    if (rows[0].children.length >= 10) {
                        alert(this.i18n.maxColsAlert); // Use translation
                        return;
                    }
                    rows.forEach(row => {
                        const newTd = row.children[colIndex].cloneNode(false);
                        newTd.innerHTML = '<br>';
                        if (cmd === 'insertColumnLeft' && this.language === 'en') {
                            row.children[colIndex].before(newTd);
                        } else if(cmd === 'insertColumnRight' && this.language === 'en') {
                            row.children[colIndex].after(newTd);
                        }
                        if (cmd === 'insertColumnLeft' && this.language === 'ar') {
                            row.children[colIndex].after(newTd);
                        } else if(cmd === 'insertColumnRight' && this.language === 'ar') {
                            row.children[colIndex].before(newTd);
                        }
                    });
                    changed = true;
                } else if (cmd === 'deleteRow') {
                    tr.remove();
                    if (table.rows.length === 0) {
                        table.closest('.resizable').remove();
                        this.selectedResizable = null;
                    }
                    changed = true;
                } else if (cmd === 'deleteColumn') {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        if (row.children[colIndex]) row.children[colIndex].remove();
                    });
                    if (rows.length > 0 && rows[0].children.length === 0) {
                        table.closest('.resizable').remove();
                        this.selectedResizable = null;
                    }
                    changed = true;
                } else if (cmd === 'deleteTable') {
                    table.closest('.resizable').remove();
                    this.selectedResizable = null;
                    changed = true;
                }
            } else {
                document.execCommand(cmd, false, val);
                changed = true;
            }
            if (changed && this.editor.innerHTML !== oldContent && cmd !== 'undo' && cmd !== 'redo') {
                this.undoStack.push(oldContent);
                this.redoStack = [];
                this.lastContent = this.editor.innerHTML;
                this.saveAll();
            }
            this.updateToolbarState();
        });
        this.linkModal.querySelector('#saveLink').addEventListener('click', () => {
            this.linkModal.classList.add('hidden');
            const url = this.linkModal.querySelector('#linkUrl').value.trim();
            const oldContent = this.editor.innerHTML;
            if (url && this.savedRange) {
                this.editor.focus();
                this.restoreSelection();
                document.execCommand('createLink', false, url);
                if (this.editor.innerHTML !== oldContent) {
                    this.undoStack.push(oldContent);
                    this.redoStack = [];
                    this.lastContent = this.editor.innerHTML;
                    this.saveAll();
                }
                document.execCommand("removeFormat",false,null);
                this.updateToolbarState();
            }
            this.savedRange = null;
            this.editor.focus();
        });
        this.linkModal.querySelector('#cancelLink').addEventListener('click', () => {
            this.linkModal.classList.add('hidden');
            this.linkModal.querySelector('#linkUrl').value = '';
            this.savedRange = null;
            this.editor.focus();
        });
        this.tableModal.querySelector('#saveTable').addEventListener('click', () => {
            let rows = parseInt(this.tableModal.querySelector('#rowsInput').value);
            let cols = parseInt(this.tableModal.querySelector('#colsInput').value);
            rows = Math.max(1, isNaN(rows) ? 1 : rows);
            cols = Math.min(10, Math.max(1, isNaN(cols) ? 1 : cols));
            this.tableModal.classList.add('hidden');
            this.editor.focus();
            this.restoreSelection();
            let tableHTML = '<table>';
            for (let i = 0; i < rows; i++) {
                tableHTML += '<tr>';
                for (let j = 0; j < cols; j++) {
                    tableHTML += '<td contenteditable="true" style="min-width:70px; min-height:30px;"><br></td>';
                }
                tableHTML += '</tr>';
            }
            tableHTML += '</table>';
            const figureHTML = `<figure class="resizable center" contenteditable="false" id="temp-new-table">${tableHTML}<figcaption class="caption" contenteditable="true">${this.i18n.caption}</figcaption></figure>`; // Use translation
            document.execCommand('insertHTML', false, figureHTML);
            const newFigure = this.editor.querySelector('#temp-new-table');
            if (newFigure) {
                newFigure.removeAttribute('id');
                this.addResizeHandle(newFigure);
                this.selectedResizable = newFigure;
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                newFigure.parentNode.insertBefore(p, newFigure.nextSibling);
                const sel = window.getSelection();
                const range = document.createRange();
                range.setStart(p, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            const oldContent = this.editor.innerHTML;
            if (oldContent !== this.lastContent) {
                this.undoStack.push(this.lastContent);
                this.redoStack = [];
                this.lastContent = oldContent;
                this.saveAll();
            }
            document.querySelector('button[data-command="justifyFull"]').style.display = "none";
            this.updateToolbarState();
        });
        const uListBtn = document.querySelector('button[data-command="insertUnorderedList"]');
        const oListBtn = document.querySelector('button[data-command="insertOrderedList"]');
        uListBtn.addEventListener("click", function() {
            // Check if the button is CURRENTLY active (meaning we are about to turn the list OFF)
            if (uListBtn.classList.contains("is-active")) {
                setTimeout(() => {
                    const selection = window.getSelection();
                    if (!selection.rangeCount) return;
                    let node = selection.anchorNode;
                    
                    // Handle text nodes
                    if (node.nodeType === 3) node = node.parentNode;
                    
                    // 2. NOW we look for the P (because the list is gone now)
                    const pElement = node.closest('p');
                    
                    if (pElement) {
                        // ... (Your existing unwrapping and normalization logic)
                        const spans = pElement.querySelectorAll('span');
                        spans.forEach(span => {
                            span.replaceWith(...span.childNodes);
                        });
                        pElement.normalize(); // 5. Merge text nodes
                        // --- 6. NEW CODE TO PUSH CARET TO END ---
                        const range = document.createRange();
                        
                        // Set the range end (and start) to the end of the P element's content.
                        // pElement.childNodes.length ensures the offset is after the last child.
                        range.setStart(pElement, pElement.childNodes.length);
                        range.collapse(true); // Collapse range to a single point (the caret)
                        // Apply the new range to the selection
                        selection.removeAllRanges();
                        selection.addRange(range);
                        // ----------------------------------------
                    }
                }, 0);
            }
        });
        oListBtn.addEventListener("click", function() {
            // Check if the button is CURRENTLY active (meaning we are about to turn the list OFF)
            if (oListBtn.classList.contains("is-active")) {
                setTimeout(() => {
                    const selection = window.getSelection();
                    if (!selection.rangeCount) return;
                    let node = selection.anchorNode;
                    
                    // Handle text nodes
                    if (node.nodeType === 3) node = node.parentNode;
                    
                    // 2. NOW we look for the P (because the list is gone now)
                    const pElement = node.closest('p');
                    
                    if (pElement) {
                        // ... (Your existing unwrapping and normalization logic)
                        const spans = pElement.querySelectorAll('span');
                        spans.forEach(span => {
                            span.replaceWith(...span.childNodes);
                        });
                        pElement.normalize(); // 5. Merge text nodes
                        // --- 6. NEW CODE TO PUSH CARET TO END ---
                        const range = document.createRange();
                        
                        // Set the range end (and start) to the end of the P element's content.
                        // pElement.childNodes.length ensures the offset is after the last child.
                        range.setStart(pElement, pElement.childNodes.length);
                        range.collapse(true); // Collapse range to a single point (the caret)
                        // Apply the new range to the selection
                        selection.removeAllRanges();
                        selection.addRange(range);
                        // ----------------------------------------
                    }
                }, 0);
            }
        });
        this.tableModal.querySelector('#cancelTable').addEventListener('click', () => {
            this.tableModal.classList.add('hidden');
        });
        this.tableModal.querySelector('#rowsInput').addEventListener('input', () => {
            let val = parseInt(this.tableModal.querySelector('#rowsInput').value);
            if (isNaN(val) || val < 1) this.tableModal.querySelector('#rowsInput').value = 1;
        });
        this.tableModal.querySelector('#colsInput').addEventListener('input', () => {
            let val = parseInt(this.tableModal.querySelector('#colsInput').value);
            if (isNaN(val) || val < 1) this.tableModal.querySelector('#colsInput').value = 1;
            if (val > 10) this.tableModal.querySelector('#colsInput').value = 10;
        });
        this.storageModal.querySelector('#closeStorage').addEventListener('click', () => {
            this.storageModal.classList.add('hidden');
        });
        this.infoModal.querySelector('#closeInfo').addEventListener('click', () => {
            this.infoModal.classList.add('hidden');
        });
        this.selectModal.querySelector('#closeSelect').addEventListener('click', () => {
            this.selectModal.classList.add('hidden');
        });
        let isFormatting = false; // The Lock
        this.editor.addEventListener('input', (event) => {
            if (isFormatting) {
                return;
            }
            isFormatting = true;
            try {
                if (this.editor.textContent.trim() === '') {
                    setTimeout(() => { // Queue asynchronously to avoid recursion
                        document.execCommand('foreColor', false, '#000000');
                        document.getElementById("fontColorInput").value = "#000000";
                        document.querySelector('#foreColorBar').style.backgroundColor = "#000000";
                        document.execCommand('backColor', false, '#ffffff');
                        document.querySelector('#highlightBar').style.backgroundColor = '#ffffff';
                        document.execCommand('fontName', false, '');
                        document.execCommand('fontSize', false, '3');
                        document.execCommand('removeFormat', false, null);
                        const p = this.editor.querySelector('p');
                        if (!(p && p.children.length === 1 && p.querySelector('br'))) {
                            this.editor.innerHTML = '<p><br></p>';
                        }
                    }, 0);
                }
                //this.updateDirections();
                this.updateToolbarState();
                this.debouncedPush();
                this.saveAll();
            } finally {
                isFormatting = false;
            }
        });
        this.editor.addEventListener('click', () => this.saveAll());
        this.editor.addEventListener('keyup', () => this.updateToolbarState());
        this.editor.addEventListener('mouseup', () => this.updateToolbarState());
        document.addEventListener('selectionchange', () => this.updateToolbarState());
        this.editor.addEventListener('click', e => {
            if (e.target.tagName.toLowerCase() === 'a' && e.target.href) {
                window.open(e.target.href, '_blank');
                e.preventDefault();
            }
            const resizables = this.editor.querySelectorAll('.resizable');
            resizables.forEach(d => {
                this.removeResizeHandles(d);
            });
            const resizable = e.target.closest('.resizable');
            if (resizable) {
                this.selectedResizable = resizable;
                this.addResizeHandle(this.selectedResizable);
                document.querySelector('button[data-command="justifyFull"]').style.display = "none";
            } else {
                document.querySelector('button[data-command="justifyFull"]').style.display = "block";
                this.selectedResizable = null;
            }
            this.updateToolbarState();
        });
        document.addEventListener('mousedown', e => this.onMouseDown(e));
        document.addEventListener('touchstart', e => this.onTouchStart(e), { passive: false });
        this.editor.addEventListener('keydown', e => this.onKeyDown(e));
        this.editor.addEventListener('blur', () => {
            this.fontSizeSelect.selectedIndex = 0;
        });
    }
    /**
        * @method saveSelection
        * @description Saves the current text selection range.
        */
    saveSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount) this.savedRange = sel.getRangeAt(0).cloneRange();
    }
    /**
        * @method restoreSelection
        * @description Restores the saved text selection range.
        */
    restoreSelection() {
        if (this.savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.savedRange);
        }
    }
    /**
        * @method debounce
        * @description Creates a debounced function to limit event frequency.
        */
    debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    }
    /**
        * @property debouncedPush
        * @description Debounced function for pushing content to the undo stack.
        */
    debouncedPush = this.debounce(() => {
        if (this.editor.innerHTML !== this.lastContent) {
            this.undoStack.push(this.lastContent);
            this.redoStack = [];
            this.lastContent = this.editor.innerHTML;
            this.saveAll();
        }
    }, 1000);

    /**
             * @method pushUndoState
             * @description Helper to push the current state to the undo stack.
             * @param {string} oldContent The content *before* the change.
             */
            pushUndoState(oldContent) {
                if (this.editor.innerHTML !== oldContent) {
                    this.undoStack.push(oldContent);
                    this.redoStack = [];
            this.undoStack = this.undoStack.slice(-50); // Limit undo stack to 50 entries for performance
                    this.lastContent = this.editor.innerHTML;
                    this.saveAll();
                    this.updateToolbarState();
                }
            }
    /**
        * @method resetEditorStyles
        * @description Resets text formatting in the editor.
        */
    resetEditorStyles() {
        this.editor.blur();
        this.editor.focus();
        document.execCommand('foreColor', false, '#000000');
        document.getElementById("fontColorInput").value = "#000000";
        document.querySelector('#foreColorBar').style.backgroundColor = "#000000";
        document.execCommand('backColor', false, '#ffffff');
        document.querySelector('#highlightBar').style.backgroundColor = '#ffffff';
        const defaultFont = this.language === 'ar' ? 'Amiri' : 'Inter';
        document.execCommand('fontName', false, defaultFont);
        document.execCommand('fontSize', false, '3');
        document.execCommand('removeFormat', false, null);
        const sel = window.getSelection();
        sel.removeAllRanges();
    }
    /**
        * @method applyInlineStyle
        * @description Applies an inline style to the selected text or insertion point.
        * @param {string} property The CSS property to apply (e.g., 'font-size').
        * @param {string} value The value for the CSS property (e.g., '48px').
        */
    applyInlineStyle(property, value) {
                const sel = window.getSelection();
                if (sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    if (!range.collapsed) {
                        const span = document.createElement('span');
                        span.style[property] = value;
                span.style.lineHeight = 'normal';
                try{
                    range.surroundContents(span);
                }catch(_){
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        let anchor = selection.anchorNode;
                        // Ensure we are looking at an Element, not a Text Node
                        if (anchor.nodeType === 3) anchor = anchor.parentElement;
                        // Check siblings of the current element
                        const next = anchor.nextElementSibling; // Skips text nodes automatically
                        const prev = anchor.previousElementSibling;
                        if (anchor.tagName === 'SPAN' && next?.tagName === 'FONT') {
                            if(next?.getElementsByTagName('span').length > 0){
                                this.selectModal.classList.remove('hidden');
                            } else {
                                this.selectModal.classList.remove('hidden');
                            }
                        } else if (anchor.tagName === 'SPAN' && prev?.tagName === 'FONT') {
                            if(prev?.getElementsByTagName('span').length > 0){
                                this.selectModal.classList.remove('hidden');
                            } else{
                                this.selectModal.classList.remove('hidden');
                            }
                        } else {
                            this.selectModal.classList.remove('hidden');
                        }
                        return;
                    }
                    
                    
                }
                // Force reflow to update layout
                span.style.display = 'none';
                span.offsetHeight;
                span.style.display = 'block';
            
                // Re-select the contents to maintain selection for repeated operations
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                sel.removeAllRanges();
                sel.addRange(newRange);
                } else {
                        const span = document.createElement('span');
                        span.style[property] = value;
                span.style.lineHeight = 'normal';
                        span.innerHTML = '&#8203;'; // Zero-width space to position the caret
                        range.insertNode(span);
                        const newRange = document.createRange();
                newRange.setStartAfter(span.firstChild);
                        newRange.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                        span.removeChild(span.firstChild); // Remove zero-width space after positioning
            
                    }
                }
            }
    removeCurrentBlankLine() {
const selection = window.getSelection();
if (!selection.rangeCount) return;
let currentNode = selection.anchorNode;
// 1. Traverse up to find the Block Element (P, DIV, LI)
// We stop if we hit the editor root so we don't delete the editor itself
const editor = document.getElementById('editor'); // Adjust ID as needed

// Handle text nodes (e.g. caret inside an empty text node)
if (currentNode.nodeType === 3) {
currentNode = currentNode.parentNode;
}

// Ensure we are inside a block-level element
const block = currentNode.closest('p, div, li');
if (!block || !editor.contains(block) || block === editor) {
console.log("No deletable block found.");
return;
}
// 2. Check if it is "Empty"
// Browsers often put a single <br> in empty paragraphs.
// We check if text is empty AND if it doesn't contain other elements (like images)
const hasText = block.textContent.trim().length > 0;
const hasImages = block.querySelector('img') !== null;
if (!hasText && !hasImages) {

// 3. Find where to put the cursor (Previous Element)
const prevBlock = block.previousElementSibling;

if (prevBlock) {
    // A. Remove the current block
    block.remove();
    // B. Move cursor to the end of the previous block
    setCaretToEnd(prevBlock);
} else {
    // Edge Case: It's the first line.
    // Usually, we don't delete the first line, or we just empty it.
    // Here, we ensure it's just a clean empty line.
    block.innerHTML = '<br>';
}
}
}
    /**
        * @method mergeNestedSpans
        * @description Merges nested spans to prevent deep nesting from repeated style applications.
        */
    mergeNestedSpans() {
        let merged;
        do {
            merged = false;
            const spans = Array.from(this.editor.querySelectorAll('span'));
            for (const span of spans) {
                if (span.children.length === 1 && span.children[0].tagName === 'SPAN') {
                    const inner = span.children[0];
                    // Merge styles (inner overrides outer)
                    for (let i = 0; i < inner.style.length; i++) {
                        const prop = inner.style[i];
                        span.style[prop] = inner.style[prop];
                    }
                    // Move inner children to outer
                    while (inner.firstChild) {
                        span.insertBefore(inner.firstChild, inner);
                    }
                    inner.remove();
                    merged = true;
                }
            }
        } while (merged);
    }
    /**
    * @method isRTLL
    * @description Checks if inserted Character is in RTL Direction or not.
    */
    isFirstCharNotRTL(text) {
        if (!text || typeof text !== 'string') {
            return true; // Or handle as needed (e.g., empty string)
        }
        
        // Regex for common RTL Unicode ranges (Hebrew, Arabic, Syriac, Thaana, etc.)
        const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u07C0-\u07FF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
        
        const firstChar = text.charAt(0);
        return !rtlRegex.test(firstChar);
    }
    getThisCurrentBlockElement() {
        let node = window.getSelection().anchorNode;
        while (node && node.nodeType !== Node.ELEMENT_NODE) {
            node = node.parentNode;
        }
        // Climb up to the nearest block-level element (adjust tags as per your editor)
        const blockTags = /^(P|DIV|LI|H[1-6]|PRE|BLOCKQUOTE)$/i;
        while (node && node !== this.editor && !blockTags.test(node.tagName)) {
            node = node.parentNode;
        }
        return node && blockTags.test(node.tagName) ? node : null;
    }
    /**
    * @method onKeyDown
    * @description Handles custom keyboard shortcuts and behaviors.
    */
     onKeyDown(e) { 
        /*const sel = window.getSelection();
        if (sel.rangeCount) {
            const currentBlock = this.getThisCurrentBlockElement();
            if (currentBlock && currentBlock.tagName === "LI" && this.language === 'en') {
                const isEmpty = currentBlock.textContent.trim().length === 0;
                if (e.key.length === 1 && !this.isFirstCharNotRTL(e.key)) {
                    if (isEmpty) {
                        e.preventDefault(); // Block RTL as first char in English LI
                        // Optionally, notify user: alert('Cannot start English list item with RTL character');
                        return; // Exit early
                    } else {
                        // For non-first RTL insert, force LTR dir and left align on the LI
                        currentBlock.dir = 'ltr';
                        currentBlock.style.textAlign = 'left';
                        // Let the insert proceed normally
                    }
                }
            }
        
        }*/
        
                    // NEW: Font size increase (Ctrl +)
                    if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
                        e.preventDefault();
                        this.saveSelection();
                        this.restoreSelection(); // Ensure selection is active
                        const oldContent = this.editor.innerHTML;
                        const sel = window.getSelection();
                        if (!sel.rangeCount) return;
                       
                        let el = sel.getRangeAt(0).startContainer;
                        if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
                        // Ensure the element is inside the editor
                        if (!this.editor.contains(el)) el = this.editor;
                        const style = window.getComputedStyle(el, null).getPropertyValue('font-size');
                        const currentPx = parseFloat(style);
                        const newPx = currentPx + 2; // Increment by 2px
                        this.applyInlineStyle('font-size', `${newPx}px`);
                this.mergeNestedSpans();
                        this.pushUndoState(oldContent); // Use helper to save undo state
                        return; // Stop further execution
                    }
                    // NEW: Font size decrease (Ctrl -)
                    if (e.ctrlKey && e.key === '-') {
                        e.preventDefault();
                        this.saveSelection();
                        this.restoreSelection();
                        const oldContent = this.editor.innerHTML;
                        const sel = window.getSelection();
                        if (!sel.rangeCount) return;
                      let el = sel.getRangeAt(0).startContainer;
                        if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
                       
                        // Ensure the element is inside the editor
                        if (!this.editor.contains(el)) el = this.editor;
                        const style = window.getComputedStyle(el, null).getPropertyValue('font-size');
                        const currentPx = parseFloat(style);
                        const minPx = 10; // Minimum pixel size (approx. HTML size 1)
                        let newPx = currentPx - 2; // Decrement by 2px
                        if (newPx < minPx) newPx = minPx;
                        this.applyInlineStyle('font-size', `${newPx}px`);
                this.mergeNestedSpans();
                       
                        this.pushUndoState(oldContent); // Use helper to save undo state
                        return; // Stop further execution
                    }

                    if (e.key === 'Enter' || e.key === ' ') {
                        try {
                            const currentValue = document.queryCommandValue('backColor').toLowerCase();
                            const isHighlightActive = !(currentValue === 'rgb(0, 0, 0)' || currentValue === 'rgb(255, 255, 255)' || currentValue === '#000000' || currentValue === '#ffffff' || currentValue === 'transparent' || currentValue === '');
                            if (isHighlightActive) {
                                if (e.key === 'Enter'){
                                    document.querySelector('#highlightBar').style.backgroundColor = '#ffffff';
                                    //document.execCommand('insertHTML', false, "<p></p>");
                                }
                                document.execCommand('backColor', false, '#ffffff');
                                document.querySelector('#highlightBar').style.backgroundColor = '#ffffff';
                            }else{
                                document.querySelector('#highlightBar').style.backgroundColor = "#ffffff";
                                document.execCommand('backColor', false, '#ffffff');
                            }
                        } catch (error) {
                            console.error('Error applying backColor fix on keydown:', error);
                        }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const sel = window.getSelection();
                        if (!sel.rangeCount) return;
                        const range = sel.getRangeAt(0);
                        let container = range.startContainer;
                        if (container.nodeType !== Node.ELEMENT_NODE) container = container.parentElement;
                        const blockquote = container.closest('blockquote');
                        if (blockquote) {
                            const newP = document.createElement('p');
                            newP.innerHTML = '<br>';
                          blockquote.after(newP);
                            const newRange = document.createRange();
                            newRange.setStart(newP, 0);
                            newRange.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(newRange);
                      } else {
                            document.execCommand('insertParagraph', false, null);
                        }
                        let block = sel.getRangeAt(0).startContainer;
                        while (block && block.nodeType !== Node.ELEMENT_NODE) block = block.parentNode;
                        block = block.closest('p, blockquote');
                        if (block) {
                            const spans = block.querySelectorAll('span[style*="background-color"]');
                            spans.forEach(span => {
                                if (span.innerHTML === '<br>' || span.textContent.trim() === '') {
                                    const frag = document.createDocumentFragment();
                                    while (span.firstChild) frag.appendChild(span.firstChild);
                                    span.parentNode.replaceChild(frag, span);
                                }
                            });
                        }
                        setTimeout(() => {
                            let cursorRect;
                            if (sel.rangeCount > 0) {
                                const currentRange = sel.getRangeAt(0);
                                if (currentRange.collapsed) {
                                    const tempSpan = document.createElement('span');
                                tempSpan.innerHTML = '&#8203;';
                                    currentRange.insertNode(tempSpan);
                                    cursorRect = tempSpan.getBoundingClientRect();
                                    tempSpan.parentNode.removeChild(tempSpan);
                                } else {
                                cursorRect = currentRange.getBoundingClientRect();
                                }
                                const editorRect = this.editor.getBoundingClientRect();
                                let scrollDelta = 0;
                                if (cursorRect.bottom > editorRect.bottom) {
                                    scrollDelta = cursorRect.bottom - editorRect.bottom + 20;
                                } else if (cursorRect.top < editorRect.top) {
                                    scrollDelta = cursorRect.top - editorRect.top - 20;
                                }
                                if (scrollDelta !== 0) {
                                    this.editor.scrollTop += scrollDelta;
                                }
                            }
                        }, 0);
                        this.updateToolbarState();
                        return;
                    }
                    if (e.key === 'Delete') {
                        const oldContent = this.editor.innerHTML;
                        const sel = window.getSelection();
                        if (!sel.rangeCount) return;
                        const range = sel.getRangeAt(0);
                        if (range.collapsed) {
                            let node = range.startContainer;
                            if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
                            const td = node.closest('td');
                            if (td && (td.innerHTML === '<br>' || td.textContent.trim() === '')) {
                                e.preventDefault();
                                const resizable = td.closest('.resizable');
                                if (resizable) {
                                    resizable.remove();
                                    this.selectedResizable = null;
                                    this.updateToolbarState();
                                    return;
                                }
                            }
                        }
                    if (this.selectedResizable) {
                      e.preventDefault();
                        this.selectedResizable.remove();
                        this.selectedResizable = null;
                      this.updateToolbarState();
                    }
            if (this.editor.innerHTML !== oldContent) {
                this.undoStack.push(oldContent);
                this.redoStack = [];
                this.lastContent = this.editor.innerHTML;
                this.saveAll();
            }
        }
     }
    /**
        * @method isRTL
        * @description Checks if a given text string contains RTL characters.
        */
    isRTL(text) {
        return /[\u0600-\u06FF\u0750-\u077F]/.test(text);
    }
    /**
        * @method updateDirections
        * @description Updates the dir attribute for all block-level elements based on content.
        */
    updateDirections() {
        const blocks = this.editor.querySelectorAll('p, blockquote, ol, ul, li, td');
        blocks.forEach(b => {
            const t = b.textContent.trim();
            if (t) {
                b.dir = this.isRTL(t) ? 'rtl' : 'ltr';
                if (!b.style.textAlign) {
                    b.style.textAlign = b.dir === 'rtl' ? 'right' : 'left';
                }
            }
            
        });
    }
    /**
        * @method isURL
        * @description Checks if given text is a URL form.
        */
    isURL(url){
            const expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
            const regex = new RegExp(expression);
            return url.match(regex);
    }
    /**
        * @method updateToolbarState
        * @description Updates the active state of all toolbar buttons based on current selection.
        */
    updateToolbarState() {
        const commandButtons = this.toolbar.querySelectorAll('button[data-command]');
        let superActive = false, subActive = false;
        const sel = window.getSelection();
        let isInBlockquote = false;
        let isInTable = false;
        let node = null;
        if (sel.rangeCount) {
            node = sel.getRangeAt(0).startContainer;
            if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
            isInBlockquote = node.closest('blockquote') !== null;
            isInTable = node.closest('td') !== null || (this.selectedResizable && this.selectedResizable.querySelector('table'));
        }
        this.tableOperationsButton.disabled = !isInTable;
        commandButtons.forEach(btn => {
            const cmd = btn.dataset.command;
            if (['undo','redo','createLink','unlink','removeFormat','clearAll'].includes(cmd)) return;
            if (cmd === 'insertBlockquote') {
                btn.classList.toggle('is-active', isInBlockquote);
                return;
            }
            try {
                const active = document.queryCommandState(cmd);
                btn.classList.toggle('is-active', active);
                if (cmd === 'superscript') superActive = active;
                if (cmd === 'subscript') subActive = active;
                if (cmd.includes('justify') && this.selectedResizable) btn.classList.remove("is-active");
            } catch (_) {}
        });
        if (superActive) {
            this.subscriptBtn.disabled = true;
            this.superscriptBtn.disabled = false;
        } else if (subActive) {
            this.superscriptBtn.disabled = true;
            this.subscriptBtn.disabled = false;
        } else {
            this.superscriptBtn.disabled = false;
            this.subscriptBtn.disabled = false;
        }
        try {
            const n = document.queryCommandValue('fontName').replace(/["']/g,'').toLowerCase();
            const opt = this.fontOptions.find(f => f.value.toLowerCase() === n);
            if (opt) {
                this.fontNameButton.firstChild.textContent = opt.label;
                this.fontNameValue = opt.value;
            } else {
                this.fontNameButton.firstChild.textContent = this.i18n.fontFamily;
                this.fontNameValue = '';
            }
        } catch (_) {
            this.fontNameButton.firstChild.textContent = this.i18n.fontFamily;
            this.fontNameValue = '';
        }
        try {
            let fontSizeValue = document.queryCommandValue('fontSize');
            const range = sel.getRangeAt(0);
            let element = range.startContainer;
            if (element.nodeType === Node.TEXT_NODE) {
                element = element.parentElement;
            }
            // Changed: Also check if fontSizeValue ==7 and px >36 (threshold for size7; adjust if needed based on browser defaults)
            this.fontSizeSelect.value = fontSizeValue || '';
        } catch (_) {
            this.fontSizeSelect.value = '';
        }
        document.getElementById("fontColorInput").addEventListener('input', function() {
            const selectedColor = this.value;
            document.querySelector('#foreColorBar').style.backgroundColor = selectedColor;
        });

        let align = this.language === 'ar' ? 'justifyRight' : 'justifyLeft';
        if (this.selectedResizable) {
            if (this.selectedResizable.classList.contains('center')) align = 'justifyCenter';
            else if (this.selectedResizable.classList.contains('right')) align = 'justifyLeft';
            else if (this.selectedResizable.classList.contains('left')) align = 'justifyRight';
            else if (this.selectedResizable.classList.contains('full')) align = 'justifyFull';
        } else if (isInTable && node.closest('td')) {
            const td = node.closest('td');
            let currentAlign = td.style.textAlign || (this.language === 'ar' ? 'right' : 'left');
            if (currentAlign === 'left') align = this.language === 'ar' ? 'justifyRight' : 'justifyLeft';
            else if (currentAlign === 'right') align = this.language === 'ar' ? 'justifyLeft' : 'justifyRight';
            else if (currentAlign === 'center') align = 'justifyCenter';
            else if (currentAlign === 'justify') align = 'justifyFull';
        } else {
            if (document.queryCommandState('justifyCenter')) align = 'justifyCenter';
            else if (document.queryCommandState('justifyRight')) align = 'justifyRight';
            else if (document.queryCommandState('justifyFull')) align = 'justifyFull';
            else if (document.queryCommandState('justifyLeft')) align = 'justifyLeft';
        }
        this.alignmentButton.innerHTML = this.alignmentIcons[align];

        try {
            if (sel && !sel.isCollapsed) {
                let currentBack = document.queryCommandValue('backColor');
                let currentFore = document.queryCommandValue('foreColor');
                if (currentBack) {
                    const hex = this.colorToHex(currentBack).toLowerCase();
                    if (hex !== '#ffffff' && hex !== '#000000' && hex !== 'transparent' && hex !== '') {
                        this.highlightContainer.querySelector('#highlightBar').style.backgroundColor = hex;
                        this.currentHighlightColor = hex;
                    }else{
                        this.currentHighlightColor = "#ffffff";
                        this.highlightContainer.querySelector('#highlightBar').style.backgroundColor = hex;
                    }
                }
                //const buttons = this.toolbar.querySelectorAll('button[data-command]:not([data-command="unlink"]):not([data-command="createLink"]):not([data-command="insertTable"]):not([data-command="justifyRight"]):not([data-command="justifyLeft"]):not([data-command="justifyCenter"]):not([data-command="justifyFull"]):not([data-command="insertUnorderedList"]):not([data-command="insertOrderedList"]):not([data-command="removeFormat"]):not([data-command="undo"]):not([data-command="redo"]):not([data-command="clearAll"]):not([data-command="showInfo"])');
                
                if (currentFore){
                    const hex0 = this.colorToHex(currentFore).toLowerCase();
                    document.querySelector('#foreColorBar').style.backgroundColor = hex0;
                    this.fontColorInput.value = hex0;
                }
            }else{
                
                let currentBack = document.queryCommandValue('backColor');
                let currentFore = document.queryCommandValue('foreColor');
                if (currentBack) {
                    const hex = this.colorToHex(currentBack).toLowerCase();
                    if (hex !== '#ffffff' && hex !== '#000000' && hex !== 'transparent' && hex !== '') {
                        this.highlightContainer.querySelector('#highlightBar').style.backgroundColor = hex;
                        this.currentHighlightColor = hex;
                    }else{
            
                    }
                }
                if (currentFore){
                    const hex0 = this.colorToHex(currentFore).toLowerCase();
                    document.querySelector('#foreColorBar').style.backgroundColor = hex0;
                    this.fontColorInput.value = hex0;
                }
            }
        } catch (_) {}
    }
    /**
        * @method colorToHex
        * @description Converts an RGB color string to a hex string.
        */
    colorToHex(c) {
        c = c.toLowerCase();
        if (c.startsWith('#')) return c;
        if (c === 'transparent' || !c || c === 'rgba(0,0,0,0)' || c === 'rgba(0, 0, 0, 0)') return 'transparent';
        const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*([\d.]+))?\)$/);
        if (!m) return 'transparent';
        if (m[4] && parseFloat(m[5]) === 0) return 'transparent';
        const toHex = v => ('0' + parseInt(v,10).toString(16)).slice(-2);
        return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
    }
    /**
        * @method saveAll
        * @description Saves the editor content to localStorage if enabled, with error handling for quota exceeded.
        */
    saveAll() {
        if (this.useLocalStorage) {
            const content = this.editor.innerHTML;
            try {
                localStorage.setItem('jCaretContent', content);
            } catch (e) {
                if ((e.name === 'QuotaExceededError' || e.code === 22) && !this.hasShownStorageWarning) {
                    this.storageModal.classList.remove('hidden');
                    this.hasShownStorageWarning = true;
                }
            }
        }
    }
    /**
        * @method updateTableMenu
        * @description Disables table insert buttons if max column limit is reached.
        */
    updateTableMenu() {
        const insertLeftBtn = this.tableMenu.querySelector('[data-command="insertColumnLeft"]');
        const insertRightBtn = this.tableMenu.querySelector('[data-command="insertColumnRight"]');
        const sel = window.getSelection();
        let table = null;
        if (sel.rangeCount) {
            let node = sel.anchorNode;
            while (node && node.nodeName !== 'TABLE') {
                if (node.nodeName === 'TD') {
                    table = node.closest('table');
                    break;
                }
                node = node.parentNode;
            }
        }
        if (!table && this.selectedResizable) {
            table = this.selectedResizable.querySelector('table');
        }
        let colCount = 0;
        if (table && table.rows[0]) {
            colCount = table.rows[0].cells.length;
        }
        const disable = colCount >= 10;
        if (insertLeftBtn) insertLeftBtn.disabled = disable;
        if (insertRightBtn) insertRightBtn.disabled = disable;
    }
    /**
        * @method addResizeHandle
        * @description Adds the resize handle to a resizable element (image or table container).
        */
    addResizeHandle(div) {
        const handles = div.querySelectorAll('.resize-handle');
        handles.forEach(h => h.remove());
        div.classList.add('selected');
        if (div.classList.contains('full')) return;
        if (div.querySelector('table')) return;
        const handle = document.createElement('div');
        handle.className = 'resize-handle se';
        div.appendChild(handle);
    }
    /**
        * @method removeResizeHandles
        * @description Removes the resize handle from a resizable element.
        */
    removeResizeHandles(div) {
        const handles = div.querySelectorAll('.resize-handle');
        handles.forEach(h => h.remove());
        div.classList.remove('selected');
    }
    /**
        * @method onMouseDown
        * @description Initiates the resizing process on mouse down.
        */
    onMouseDown(e) {
        if (e.target.classList.contains('resize-handle')) {
            e.preventDefault();
            this.currentResizable = e.target.parentElement;
            this.resizeOldContent = this.editor.innerHTML;
            const table = this.currentResizable.querySelector('table');
            const img = this.currentResizable.querySelector('img');
            this.startWidth = this.currentResizable.offsetWidth;
            this.minWidth = table ? table.rows[0].cells.length * 70 : (img ? 50 : 50);
            this.aspectRatio = img ? img.naturalWidth / img.naturalHeight : null;
            this.startX = e.clientX;
            this.isResizing = true;
            document.addEventListener('mousemove', e => this.onMouseMove(e));
            document.addEventListener('mouseup', e => this.onMouseUp(e));
        }
    }
    /**
        * @method onTouchStart
        * @description Initiates the resizing process on touch start.
        */
    onTouchStart(e) {
        if (e.target.classList.contains('resize-handle')) {
            e.preventDefault();
            this.currentResizable = e.target.parentElement;
            this.resizeOldContent = this.editor.innerHTML;
            const table = this.currentResizable.querySelector('table');
            const img = this.currentResizable.querySelector('img');
            this.startWidth = this.currentResizable.offsetWidth;
            this.minWidth = table ? table.rows[0].cells.length * 70 : (img ? 50 : 50);
            this.aspectRatio = img ? img.naturalWidth / img.naturalHeight : null;
            this.startX = e.touches[0].clientX;
            this.isResizing = true;
            document.addEventListener('touchmove', e => this.onTouchMove(e), { passive: false });
            document.addEventListener('touchend', e => this.onTouchEnd(e));
        }
    }
    /**
        * @method onMouseMove
        * @description Handles element resizing when the mouse moves.
        */
    onMouseMove(e) {
        if (!this.isResizing) return;
        e.preventDefault();
        const deltaX = e.clientX - this.startX;
        let newWidth = this.startWidth + deltaX;
        newWidth = Math.max(this.minWidth, Math.min(newWidth, this.editor.offsetWidth));
        this.currentResizable.style.width = `${newWidth}px`;
        if (this.aspectRatio) {
            this.currentResizable.style.height = `${newWidth / this.aspectRatio + 25}px`;
        } else {
            this.currentResizable.style.height = 'auto';
        }
        if (this.currentResizable.querySelector('table')) {
            this.currentResizable.querySelector('table').style.width = '100%';
        }
    }
    /**
        * @method onTouchMove
        * @description Handles element resizing when a touch moves.
        */
    onTouchMove(e) {
        if (!this.isResizing) return;
        e.preventDefault();
        const deltaX = e.touches[0].clientX - this.startX;
        let newWidth = this.startWidth + deltaX;
        newWidth = Math.max(this.minWidth, Math.min(newWidth, this.editor.offsetWidth));
        this.currentResizable.style.width = `${newWidth}px`;
        if (this.aspectRatio) {
            this.currentResizable.style.height = `${newWidth / this.aspectRatio + 25}px`;
        } else {
            this.currentResizable.style.height = 'auto';
        }
        if (this.currentResizable.querySelector('table')) {
            this.currentResizable.querySelector('table').style.width = '100%';
        }
    }
    /**
        * @method onMouseUp
        * @description Ends the resizing process on mouse up.
        */
    onMouseUp(e) {
        if (this.isResizing) {
            this.isResizing = false;
            document.removeEventListener('mousemove', e => this.onMouseMove(e));
            document.removeEventListener('mouseup', e => this.onMouseUp(e));
            if (this.editor.innerHTML !== this.resizeOldContent) {
                this.undoStack.push(this.resizeOldContent);
                this.redoStack = [];
                this.lastContent = this.editor.innerHTML;
                this.saveAll();
            }
        }
    }
    /**
        * @method onTouchEnd
        * @description Ends the resizing process on touch end.
        */
    onTouchEnd(e) {
        if (this.isResizing) {
            this.isResizing = false;
            document.removeEventListener('touchmove', e => this.onTouchMove(e));
            document.removeEventListener('touchend', e => this.onTouchEnd(e));
            if (this.editor.innerHTML !== this.resizeOldContent) {
                this.undoStack.push(this.resizeOldContent);
                this.redoStack = [];
                this.lastContent = this.editor.innerHTML;
                this.saveAll();
            }
        }
    }
}
