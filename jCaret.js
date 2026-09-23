/**
 * @class jCaret
 * @description A lightweight, fully featured, and customizable rich-text editor.
 * The editor is designed to be responsive and supports both LTR and RTL languages.
 * All static CSS is externalized to the <head> of the document.
 * Made With Love By: www.auktubli.com.
 */
class jCaret {
    // ---- Page geometry (A4) ------------------------------------------------
    static MM = 96 / 25.4;          // CSS pixels per millimetre
    static PAGE_W = 210;            // page width  (mm)
    static PAGE_H = 297;            // page height (mm)
    static PAGE_GAP = 16;           // empty space drawn between two sheets on screen (px); 0 when printing
    static NO_SPLIT = 'img, table, figure, iframe, video, canvas, svg, object, embed, input, textarea, select, button';
    static MIN_MARGIN = 10;         // smallest allowed margin (mm) on bottom / left / right, and the default for all four
    static MIN_MARGIN_TOP = 5;      // the top margin alone is allowed a little smaller
    static PAGE_NUM_OFFSET = 6.77;  // "1 / N": fixed distance (mm) from the page's bottom edge, whatever the margin
                                     // is (as long as it fits below the last line of text - MIN_MARGIN keeps it so)
    static MIN_CONTENT = 40;        // the smallest text area a page may keep (mm)
    static DEFAULT_MARGINS = { top: 10, bottom: 10, left: 10, right: 10 };

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
     * @param {boolean} [options.showPageBreaks=true] Page mode (A4 sheets, page guides, margins, add-page).
     * @param {object} [options.margins] Default page margins in mm: {top, bottom, left, right}.
     * @param {number} [options.pageNumberInset=15] Fixed distance in mm between the right edge of the sheet and the "1 / 3" page number.
     *        It does NOT depend on the page's right margin. Raise it to move the number further to the left.
     */
    constructor(containerSelector, options = {}) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            throw new Error('Container not found');
        }
        // 1. Configuration and Defaults
        this.width = options.width || '880px';
        this.height = options.height || '400px';
        this.heightMode = options.heightMode || 'fixed';
        this.useLocalStorage = options.useLocalStorage || false;
        this.language = options.language || 'en'; // Default to 'en' if not specified
        this.dir = this.language === 'ar' ? 'rtl' : 'ltr';
        this.borderRadius = options.borderRadius || '0';
        this.showPageBreaks = options.showPageBreaks !== false;

        // Page margins (mm). `defaultMargins` is used by every page unless the page has its own override.
        this.defaultMargins = Object.assign({}, jCaret.DEFAULT_MARGINS, options.margins || {});
        this.pageNumberInset = Number.isFinite(parseFloat(options.pageNumberInset)) ? Math.max(0, parseFloat(options.pageNumberInset)) : 15;
        this.pageMargins = {};          // { pageIndex: {top,bottom,left,right} }
        this._marginPage = null;        // page currently shown in the margin panel
        this._currentPage = 0;
        this._totalPages = 1;
        this.watermark = { text: '', opacity: 0.15, color: '#888888', angle: -35, fontSize: 60 };
        if (this.useLocalStorage) {
            try {
                const m = JSON.parse(localStorage.getItem('jCaretMargins') || 'null');
                if (m && m.def) this.defaultMargins = Object.assign({}, this.defaultMargins, m.def);
                if (m && m.pages) this.pageMargins = m.pages;
            } catch (_) { /* ignore corrupt data */ }
            try {
                const w = JSON.parse(localStorage.getItem('jCaretWatermark') || 'null');
                if (w) this.watermark = Object.assign({}, this.watermark, w);
            } catch (_) { /* ignore corrupt data */ }
        }

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

        // Bound handlers (so they can really be removed later)
        this._boundMouseMove = e => this.onMouseMove(e);
        this._boundMouseUp = e => this.onMouseUp(e);
        this._boundTouchMove = e => this.onTouchMove(e);
        this._boundTouchEnd = e => this.onTouchEnd(e);

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
        // Code: selected text becomes a colored code block (or inline code)
        this.codeBtn = this.createButton({ command: 'codeBlock', title: this.i18n.codeBlock, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg>' });
        this.toolbar.appendChild(this.codeBtn);
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
        this.highlightBar = this.highlightButton.querySelector('#highlightBar');
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
        this.foreColorBar = this.foreColorLabel.querySelector('#foreColorBar');
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
        // Print as PDF
        this.toolbar.appendChild(this.createButton({ command: 'printPdf', title: this.i18n.printPdf, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"/></svg>' }));
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
        this.justifyFullBtn = this.createButton({ command: 'justifyFull', title: this.i18n.alignJustify, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5M3.75 22.5h16.5"/></svg>' });
        this.alignmentMenu.appendChild(this.justifyFullBtn);
        // Divider
        this.toolbar.appendChild(this.createDivider());
        // Unordered List
        this.uListBtn = this.createButton({ command: 'insertUnorderedList', title: this.i18n.unorderedList, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>' });
        this.toolbar.appendChild(this.uListBtn);
        // Ordered List
        this.oListBtn = this.createButton({ command: 'insertOrderedList', title: this.i18n.orderedList, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6h9"/><path d="M11 12h9"/><path d="M12 18h8"/><path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4"/><path d="M6 10v-6l-2 2"/></svg>' });
        this.toolbar.appendChild(this.oListBtn);
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
        // Handwriting / drawing: a container button + a dropdown toolbar (pen/highlighter/eraser, color, size,
        // undo/redo/clear, done/cancel). Clicking it starts drawing directly on the page - there is no modal.
        this.handwriteButton = document.createElement('button');
        this.handwriteButton.id = 'handwriteButton';
        this.handwriteButton.title = this.i18n.handwriteInsert;
        this.handwriteButton.className = 'p-2 rounded-md hover:bg-gray-200';
        this.handwriteButton.innerHTML = '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25l3 3"/></svg>';
        this.toolbar.appendChild(this.handwriteButton);
        // A floating, draggable panel (not a dropdown pinned under the button) so it is never clipped by the page
        // and can be moved wherever it is out of the way - appended to <body> like the other modals.
        this.handwriteMenu = this.createHandwriteMenu();
        document.body.appendChild(this.handwriteMenu);
        // Watermark: text repeated on every page (present ones and any added later), diagonal and low-opacity.
        this.watermarkButton = document.createElement('button');
        this.watermarkButton.id = 'watermarkButton';
        this.watermarkButton.title = this.i18n.watermarkButton;
        this.watermarkButton.className = 'p-2 rounded-md hover:bg-gray-200';
        this.watermarkButton.innerHTML = '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
        this.toolbar.appendChild(this.watermarkButton);
        this.watermarkMenu = this.createWatermarkMenu();
        document.body.appendChild(this.watermarkMenu);
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
        this.tableMenu.className = 'hidden absolute top-full left-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 flex flex-col min-w-max';
        this.tableOpsContainer.appendChild(this.tableMenu);
        this.tableMenu.appendChild(this.createButton({ command: 'insertRowAbove', title: this.i18n.insertRowAbove, label: this.i18n.insertRowAbove, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m-7.5-7.5h15" transform="rotate(180 12 12)"/></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'insertRowBelow', title: this.i18n.insertRowBelow, label: this.i18n.insertRowBelow, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m-7.5-7.5h15" /></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'insertColumnLeft', title: this.i18n.insertColLeft, label: this.i18n.insertColLeft, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15m-7.5-7.5v15" transform="rotate(180 12 12)"/></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'insertColumnRight', title: this.i18n.insertColRight, label: this.i18n.insertColRight, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15m-7.5-7.5v15" /></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'deleteRow', title: this.i18n.deleteRow, label: this.i18n.deleteRow, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" /></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'deleteColumn', title: this.i18n.deleteCol, label: this.i18n.deleteCol, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16" /></svg>' }));
        this.tableMenu.appendChild(this.createButton({ command: 'deleteTable', title: this.i18n.deleteTable, label: this.i18n.deleteTable, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052 .682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059 .68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>' }));
        // Divider
        this.toolbar.appendChild(this.createDivider());
        // Page tools (page mode only): Add page + Margins of the current page
        if (this.showPageBreaks) {
            this.addPageBtn = this.createButton({ command: 'addPage', title: this.i18n.addPage, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>' });
            this.toolbar.appendChild(this.addPageBtn);
            this.marginsBtn = this.createButton({ command: 'pageMargins', title: this.i18n.marginsBtn, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="3.75" y="2.75" width="16.5" height="18.5" rx="1.5"/><rect x="7.5" y="6.5" width="9" height="11" stroke-dasharray="2 2"/></svg>' });
            //this.toolbar.appendChild(this.marginsBtn);
            
        }
        // Clear All
        this.toolbar.appendChild(this.createButton({ command: 'clearAll', title: this.i18n.clearAll, innerHTML: '<svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052 .682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059 .68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>' }));
        // Info
        this.toolbar.appendChild(this.createDivider());
        this.toolbar.appendChild(this.createButton({ command: 'showInfo', title: this.i18n.infoTitle, innerHTML: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#000000" stroke-width="2"/><path d="M12 8H12.01" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12V16" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
        // 6. Editor Wrapper
        this.editorWrapper = document.createElement('div');
        this.editorWrapper.classList.add("jcaret-wrapper-anchor");
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
        this.printEmptyModal = this.createPrintEmptyModal();
        document.body.appendChild(this.printEmptyModal);
        this.printTipModal = this.createPrintTipModal();
        document.body.appendChild(this.printTipModal);
        this.infoModal = this.createInfoModal();
        document.body.appendChild(this.infoModal);
        this.selectModal = this.createSelectModal();
        document.body.appendChild(this.selectModal);
        this.clearAllModal = this.createClearAllModal();
        document.body.appendChild(this.clearAllModal);

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
                this._rehydrateInk(this.editor);
            }
        }
        this.lastContent = this.snapshot();
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
        this.updateToolbarState(); // Update toolbar after loading
        if (this.showPageBreaks) this.initPageGuides();
        // 10. Initialization
        this.addEventListeners();
        if (this.language === 'ar') this.updateDirections();
        // 11. Set initial editor direction and default font
        try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (_) {}
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
     * @description Creates and appends a style block for rules that depend on the constructor options (height, language)
     * plus every rule the page system needs (page guides, margin panel, list padding).
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
            /* Lists: ALWAYS indented, whether or not a dir attribute was set (fixes multi-line list creation) */
            #editor ul, #editor ol {
                padding-${langPadding}: 40px;
                padding-${oppLangPadding}: 0;
            }
            #editor ul[dir="ltr"], #editor ol[dir="ltr"] { padding-left: 40px; padding-right: 0; }
            #editor ul[dir="rtl"], #editor ol[dir="rtl"] { padding-right: 40px; padding-left: 0; }
            #editor ul { list-style-type: disc; }
            #editor ol { list-style-type: decimal; }
            /* Dynamic table cell rules for direction and default alignment */
            #editor td {
                direction: initial;
                text-align: initial;
            }
            figcaption.caption{
                text-align: ${langAlign};
            }
            /* Keep the caret comfortably inside the viewport when it is scrolled into view */
            #editor p, #editor li, #editor blockquote, #editor div { scroll-margin: 56px 0; }

            /* Chrome's scroll anchoring would shift the scroll position while paginate() moves blocks around
               and corrupt its measurements: switch it off for the whole editor. */
            .jcaret-wrapper-anchor, #editor, #editor * { overflow-anchor: none; }

            /* ---- Code (block + inline) with colored tokens; light theme so it also prints well ---- */
            #editor pre.jc-code {
                position: relative; direction: ltr; text-align: left !important; white-space: pre-wrap; overflow-wrap: anywhere;
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 0.9em; line-height: 1.5; tab-size: 4; margin: 1em 0;
                background: #f6f8fa; color: #24292f; border: 1px solid #d0d7de; border-radius: 6px; padding: 16px 14px 12px;
            }
            #editor pre.jc-code::before {
                content: attr(data-label); position: absolute; top: 3px; right: 8px; pointer-events: none; user-select: none;
                font: 600 9px Arial, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #8c959f;
            }
            #editor code.jc-code-inline {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: .9em; background: #eff1f3; color: #24292f; border: 1px solid #d0d7de; border-radius: 4px;
                padding: 0 4px; direction: ltr; unicode-bidi: isolate;
            }
            .jc-t-kw { color: #cf222e; } .jc-t-str { color: #0a3069; } .jc-t-com { color: #6e7781; font-style: italic; }
            .jc-t-num { color: #0550ae; } .jc-t-fn { color: #8250df; } .jc-t-type { color: #953800; }
            .jc-t-tag { color: #116329; } .jc-t-attr { color: #0550ae; } .jc-t-var { color: #953800; }

            /* Superscript / subscript take part in the line box (a tall enough line-height), so a raised character can
               never be cut off at the top of a page (0 top margin) or run into the line above it. Overrides resets that
               lift them with position:relative and line-height:0. */
            #editor sup, #editor sub { position: static; top: auto; bottom: auto; font-size: 75%; line-height: 1.4; }
            #editor sup { vertical-align: super; }
            #editor sub { vertical-align: sub; }

            /* The first / last block of the document sit exactly on the margin line (their own margin would otherwise
               add to the page margin, or - with a 0 margin - collapse out of the editor and shift the whole page). */
            #editor > :first-child { margin-top: 0 !important; }
            #editor > :last-child { margin-bottom: 0 !important; }

            /* ---- Page layout (written by paginate(); stripped from saved HTML) ---- */
            #editor [data-jc-pb] { margin-top: var(--jc-pb) !important; }
            #editor > [data-jc-side]:not(figure) {
                margin-left: var(--jc-ml) !important;
                margin-right: var(--jc-mr) !important;
            }
            /* A figure (image / table) shrinks to fit its own content instead of stretching to the full text width,
               so "centered" / "left" / "right" (set below as real margins, computed in _applySide) actually center or
               hug an edge instead of just moving an already full-width box a few pixels. The browser's own default
               figure margin is removed first, or it would add unwanted space on top of the page margin. */
            #editor > figure {
                margin: 0;
            }
            #editor > figure[data-jc-side] {
                width: -moz-fit-content;
                width: fit-content;
                max-width: calc(100% - var(--jc-ml, 0px) - var(--jc-mr, 0px)) !important;
                margin-left: var(--jc-fml, auto) !important;
                margin-right: var(--jc-fmr, auto) !important;
            }
            /* A centred image / table is centred on the PAGE (not on the text area between the margins), so it may be
               as wide as the page allows on both sides of the bigger margin. */
            #editor > figure.center[data-jc-side] {
                max-width: calc(100% - 2 * var(--jc-mm, 0px)) !important;
            }
            /* A table only shrinks below this per-cell width when it would otherwise stick out past the page margins
               (see _fitTableInFigure); a plain custom property is used because it is inherited by every cell without
               having to touch each <td> by hand. */
            #editor td, #editor th { min-width: var(--jc-cell-mw, 70px); }

            /* ---- Handwriting: a transparent drawing layer directly over the page, and the floating image it makes ---- */
            #editor { position: relative; }
            #editor > .jcaret-handwrite-overlay {
                position: absolute; top: 0; left: 0; z-index: 6; touch-action: none; cursor: crosshair;
            }
            #editor > figure.resizable.floating {
                margin: 0 !important; max-width: none !important; cursor: move;
            }
            #editor > figure.resizable.floating.selected { outline: 2px solid #2563eb; outline-offset: 2px; }

            /* While the caret is in code, every text-formatting control is disabled - dim it and block clicks so it
               reads as clearly "off"; the color-swatch <label> has no real disabled state of its own, hence .jc-disabled. */
            #toolbar button:disabled, #toolbar select:disabled, #toolbar input:disabled { opacity: .35; cursor: not-allowed; pointer-events: none; }
            #toolbar .jc-disabled { opacity: .35; cursor: not-allowed; pointer-events: none; }

            /* ---- Page guides (margins are drawn here and can never be edited) ---- */
            .jcaret-page-guides { position: absolute; overflow: hidden; pointer-events: none; z-index: 5; user-select: none; -webkit-user-select: none; }
            .jcaret-page-guides-inner { position: absolute; left: 0; right: 0; top: 0; }
            .jcaret-page-num { position: absolute; font: 10pt Arial, sans-serif; color: #555; direction: ltr; line-height: 1; }
            .jcaret-page-badge {
                position: fixed; right: 18px; bottom: 18px; z-index: 20;
                background: rgba(37, 99, 235, .92); color: #fff; direction: ltr;
                font: 600 12px Arial, sans-serif; padding: 4px 10px; border-radius: 999px;
                box-shadow: 0 1px 4px rgba(0,0,0,.25); pointer-events: none;
            }
            .jcaret-page-btn {
                position: absolute; right: 8px; width: 26px; height: 26px; padding: 0;
                display: flex; align-items: center; justify-content: center;
                border: 1px solid rgba(59,130,246,.55); border-radius: 6px;
                background: rgba(255,255,255,.94); color: #2563eb; cursor: pointer;
                pointer-events: auto; opacity: .8;
            }
            .jcaret-page-btn:hover { opacity: 1; background: #eff6ff; }
            .jcaret-page-btn svg { width: 16px; height: 16px; pointer-events: none; }

            /* ---- Margin panel ---- */
            .jcaret-margin-panel {
                position: fixed; top: 96px; right: 16px; z-index: 60; width: 300px;
                background: #fff; border: 1px solid #d1d5db; border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0,0,0,.18); padding: 12px; font: 13px/1.3 Arial, sans-serif; color: #1f2937;
            }
            .jcaret-margin-panel[hidden] { display: none; }
            .jcaret-margin-panel .jcm-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
            .jcaret-margin-panel .jcm-title { font-size: 14px; }
            .jcaret-margin-panel .jcm-x { border: 0; background: transparent; font-size: 20px; line-height: 1; cursor: pointer; color: #6b7280; padding: 0 4px; }
            .jcaret-margin-panel .jcm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .jcaret-margin-panel label { display: flex; flex-direction: column; gap: 3px; color: #4b5563; font-size: 12px; }
            .jcaret-margin-panel input[type="number"] { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 5px 6px; font-size: 13px; color: #111827; }
            .jcaret-margin-panel input[type="number"]:focus { outline: 2px solid #93c5fd; border-color: #3b82f6; }
            .jcaret-margin-panel .jcm-actions { display: flex; gap: 6px; margin-top: 12px; }
            .jcaret-margin-panel .jcm-actions button { flex: 1; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 6px; padding: 6px 4px; font-size: 12px; cursor: pointer; color: #1f2937; }
            .jcaret-margin-panel .jcm-actions button[data-act="all"] { background: #2563eb; border-color: #2563eb; color: #fff; }
            .jcaret-margin-panel .jcm-actions button[data-act="downloadPng"] { background: #059669; border-color: #059669; color: #fff; }
            .jcaret-margin-panel .jcm-actions button:hover { filter: brightness(.96); }
            @media print { .jcaret-page-guides, .jcaret-page-badge, .jcaret-margin-panel { display: none !important; } }
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
                subscript: 'أسفل', blockquote: 'اقتباس', codeBlock: 'كود برمجي (يلوّن النص المحدد)', codeLabel: 'شيفرة', highlight: 'تمييز',
                yellow: 'أصفر', blue: 'أزرق', green: 'أخضر', pink: 'وردي',
                remove: 'إزالة', fontColor: 'لون الخط', removeFormat: 'إزالة التنسيق',
                createLink: 'إنشاء رابط', unlink: 'إزالة الرابط', align: 'محاذاة',
                alignLeft: 'محاذاة إلى اليسار', alignCenter: 'محاذاة إلى الوسط',
                alignRight: 'محاذاة إلى اليمين', alignJustify: 'محاذاة كاملة',
                unorderedList: 'قائمة غير مرتبة', orderedList: 'قائمة مرتبة',
                insertImage: 'إدراج صورة', insertTable: 'إدراج جدول', tableOperations: 'عمليات الجدول',
                handwriteInsert: 'كتابة بخط اليد', handwriteTitle: 'كتابة بخط اليد',
                handwritePen: 'قلم', handwriteHighlighter: 'مُظلِّل', handwriteEraser: 'ممحاة',
                handwriteColor: 'اللون', handwriteSize: 'الحجم', handwriteUndo: 'تراجع', handwriteRedo: 'إعادة',
handwriteClear: 'مسح الكل', handwriteInsertBtn: 'إدراج', handwriteDone: 'تم', handwriteEmpty: 'الرسم فارغ - ارسم شيئاً أولاً.', handwriteEditHint: 'اضغط مرتين للتعديل أو المسح', rotate: 'تدوير',
                watermarkButton: 'علامة مائية', watermarkTitle: 'العلامة المائية', watermarkTextLabel: 'النص', watermarkPlaceholder: 'مثال: سري',
                watermarkOpacity: 'الشفافية', watermarkApply: 'تطبيق', watermarkRemove: 'إزالة',
                insertRowAbove: 'إدراج صف أعلى', insertRowBelow: 'إدراج صف أسفل',
                insertColLeft: 'إدراج عمود يسار', insertColRight: 'إدراج عمود يمين',
                deleteRow: 'حذف الصف', deleteCol: 'حذف العمود', deleteTable: 'حذف الجدول',
                clearAll: 'مسح الكل', insertLink: 'أدخل الرابط', linkPlaceholder: 'https://example.com',
                cancel: 'إلغاء', save: 'حفظ', rows: 'الصفوف:', cols: 'الأعمدة:', infoTitle:'حول', infoText:'إختصارات لوحة المفاتيح', by:'www.auktubli.com',
                clearAllConfirm: 'هل أنت متأكد من مسح كل المحتوى؟ سيتم إزالة العلامة المائية أيضاً.', clearAllTitle: 'مسح الكل', clearAllOk: 'مسح', maxColsAlert: 'الحد الأقصى 10 أعمدة', forQuote:'سطر إقتباس جديد', forEnlarge:'تكبير الخط على مستوى السطر', forShrink:'تصغير الخظ على مستوى السطر', forDelete:'حذف صورة أو جدول',
                forTab: 'إدراج 4 مسافات',
                caption: 'تسمية توضيحية',
                warning: 'تحذير',
                ok: 'موافق',
                storageWarning: 'حجم محتوى المحرر كبير جدًا، لذا لن يتم حفظ بعضه عند إعادة تحميل الصفحة في التخزين المحلي، خاصة الصور المرفوعة.',
                selectWarning: 'النص المحدد متعدد!.',
                insertEmoji: 'إدراج إيموجي',
                printPdf: 'طباعة كملف PDF (A4)',
                printEmptyTitle: 'لا يوجد ما يمكن طباعته',
                printEmptyMsg: 'الصفحة فارغة. اكتب نصاً أو أدرج صورة أو جدولاً ثم اضغط على زر الطباعة.',
                printTipTitle: 'قبل الطباعة',
                printTipDest: 'في نافذة الطباعة اختر <b>الوجهة: حفظ بتنسيق PDF (Save as PDF)</b>.',
                printTipLinks: 'هذا الخيار يُبقي الروابط قابلة للنقر داخل ملف PDF. الطابعات الافتراضية الأخرى (مثل «Microsoft Print to PDF») تُلغي الروابط.',
                printTipSettings: 'الإعدادات المناسبة: حجم الورق <b>A4</b>، الهوامش <b>الافتراضية</b> (أو «بدون»).',
                printTipContinue: 'متابعة الطباعة', printTipDontShow: 'لا تُظهر هذه الرسالة مرة أخرى',
                printA4Note: 'المستند مُرتَّب على صفحات بحجم A4 (210 × 297 مم) وتتم طباعته بنفس الحجم. الخطوط الزرقاء الخفيفة تُظهر هوامش كل صفحة.',
                downloadPagePng: 'تنزيل هذه الصفحة كصورة PNG',
                page: 'صفحة', pageEnd: 'نهاية الصفحة',
                bottomMargin: 'الهامش السفلي', topMargin: 'الهامش العلوي',
                addPage: 'إضافة صفحة', pageMargins: 'هوامش الصفحة', marginsBtn: 'هوامش الصفحة الحالية',
                marginTop: 'أعلى (مم)', marginBottom: 'أسفل (مم)', marginLeft: 'يسار (مم)', marginRight: 'يمين (مم)',
                applyAllPages: 'تطبيق على كل الصفحات', resetMargins: 'إعادة ضبط', close: 'إغلاق',
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
                subscript: 'Subscript', blockquote: 'Blockquote', codeBlock: 'Code (colors the selected text)', codeLabel: 'CODE', highlight: 'Highlight',
                yellow: 'Yellow', blue: 'Blue', green: 'Green', pink: 'Pink',
                remove: 'Remove', fontColor: 'Font Color', removeFormat: 'Remove Format',
                createLink: 'Create Link', unlink: 'Unlink', align: 'Align',
                alignLeft: 'Align Left', alignCenter: 'Align Center',
                alignRight: 'Align Right', alignJustify: 'Align Justify',
                unorderedList: 'Unordered List', orderedList: 'Ordered List',
                insertImage: 'Insert Image', insertTable: 'Insert Table', tableOperations: 'Table Operations',
                handwriteInsert: 'Handwriting', handwriteTitle: 'Handwriting',
                handwritePen: 'Pen', handwriteHighlighter: 'Highlighter', handwriteEraser: 'Eraser',
                handwriteColor: 'Color', handwriteSize: 'Size', handwriteUndo: 'Undo', handwriteRedo: 'Redo',
handwriteClear: 'Clear all', handwriteInsertBtn: 'Insert', handwriteDone: 'Done', handwriteEmpty: 'The drawing is empty - draw something first.', handwriteEditHint: 'Double-click to edit or erase', rotate: 'Rotate',
                watermarkButton: 'Watermark', watermarkTitle: 'Watermark', watermarkTextLabel: 'Text', watermarkPlaceholder: 'e.g. CONFIDENTIAL',
                watermarkOpacity: 'Opacity', watermarkApply: 'Apply', watermarkRemove: 'Remove',
                insertRowAbove: 'Insert Row Above', insertRowBelow: 'Insert Row Below',
                insertColLeft: 'Insert Column Left', insertColRight: 'Insert Column Right',
                deleteRow: 'Delete Row', deleteCol: 'Delete Column', deleteTable: 'Delete Table',
                clearAll: 'Clear All', insertLink: 'Enter Link', linkPlaceholder: 'https://example.com',
                cancel: 'Cancel', save: 'Save', rows: 'Rows:', cols: 'Columns:', infoTitle:'About',infoText:'Keyboard Shortcuts', by:'www.auktubli.com.',
                clearAllConfirm: 'Are you sure you want to clear all content? This will also remove the watermark.', clearAllTitle: 'Clear All', clearAllOk: 'Clear', maxColsAlert: 'Maximum of 10 columns allowed', forQuote:'New quote line', forEnlarge:'Enlarge text font (line level)', forShrink:'Shrink text font (line level)', forDelete:'Remove image or table',
                forTab: 'Insert 4 spaces',
                caption: 'Caption',
                warning: 'Warning',
                ok: 'OK',
                storageWarning: 'The content of the editor is too big, so some of it won\'t be saved on page reload in local storage, especially uploaded images.',
                selectWarning: 'Multi Selected!.',
                insertEmoji: 'Insert Emoji',
                printPdf: 'Print as PDF (A4)',
                printEmptyTitle: 'Nothing to print',
                printEmptyMsg: 'The page is empty. Type some text or insert an image or a table, then click Print again.',
                printTipTitle: 'Before you print',
                printTipDest: 'In the print window, choose <b>Destination: Save as PDF</b>.',
                printTipLinks: 'This keeps the links clickable in the PDF. Other PDF printers (such as "Microsoft Print to PDF") remove them.',
                printTipSettings: 'Recommended settings: paper size <b>A4</b> and margins <b>Default</b> (or None).',
                printTipContinue: 'Continue to print', printTipDontShow: "Don't show this again",
                printA4Note: 'The document is laid out on A4 sheets (210 × 297 mm) and is printed at that size. The light-blue guides show the margins of each page.',
                downloadPagePng: 'Download this page as PNG',
                page: 'Page', pageEnd: 'End of page',
                bottomMargin: 'Bottom margin', topMargin: 'Top margin',
                addPage: 'Add Page', pageMargins: 'Page margins', marginsBtn: 'Margins of the current page',
                marginTop: 'Top (mm)', marginBottom: 'Bottom (mm)', marginLeft: 'Left (mm)', marginRight: 'Right (mm)',
                applyAllPages: 'Apply to all pages', resetMargins: 'Reset', close: 'Close',
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
        if (attrs.label) {
            // A menu row: icon + visible text, one under the other in a dropdown (e.g. the table-operations menu),
            // rather than the icon-only square used in the main toolbar.
            button.className = 'flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-gray-200 text-sm whitespace-nowrap';
            button.innerHTML = `${attrs.innerHTML || ''}<span class="pointer-events-none">${attrs.label}</span>`;
        } else {
            button.className = 'p-2 rounded-md hover:bg-gray-200';
            if (attrs.innerHTML) button.innerHTML = attrs.innerHTML;
        }
        if (attrs.title) button.title = attrs.title;
        if (attrs.command) button.dataset.command = attrs.command;
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
    createPrintTipModal() {
        const div = document.createElement('div');
        div.id = 'printTipModal';
        div.className = 'hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
        div.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" dir="${this.dir}">
                <h3 class="text-lg font-medium mb-3">${this.i18n.printTipTitle}</h3>
                <p class="mb-2">${this.i18n.printTipDest}</p>
                <p class="mb-2 text-sm text-gray-700">${this.i18n.printTipLinks}</p>
                <p class="mb-3 text-sm text-gray-700">${this.i18n.printTipSettings}</p>
                <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" id="printTipDontShow"> <span>${this.i18n.printTipDontShow}</span>
                </label>
                <div class="flex justify-end gap-2 mt-4">
                    <button id="cancelPrintTip" class="px-4 py-2 rounded-md bg-gray-200 text-sm font-medium hover:bg-gray-300">${this.i18n.cancel}</button>
                    <button id="continuePrintTip" class="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">${this.i18n.printTipContinue}</button>
                </div>
            </div>
        `;
        return div;
    }
    createPrintEmptyModal() {
        const div = document.createElement('div');
        div.id = 'printEmptyModal';
        div.className = 'hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
        div.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" dir="${this.dir}">
                <h3 class="text-lg font-medium mb-4">${this.i18n.printEmptyTitle}</h3>
                <p>${this.i18n.printEmptyMsg}</p>
                <p class="mt-3 text-sm text-gray-600">${this.i18n.printA4Note}</p>
                <div class="flex justify-end gap-2 mt-4">
                    <button id="closePrintEmpty" class="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">${this.i18n.ok}</button>
                </div>
            </div>
        `;
        return div;
    }
    /**
     * @method createHandwriteMenu
     * @description The handwriting dropdown toolbar: pen/highlighter/eraser, color, size, undo/redo/clear, and
     * done/cancel. Opening it starts a drawing overlay directly on the page (see startHandwriting) - this menu has
     * no canvas of its own.
     */
    createHandwriteMenu() {
        const t = this.i18n;
        const swatches = ['#000000', '#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed'];
        const div = document.createElement('div');
        div.id = 'handwriteMenu';
        div.className = 'hidden fixed bg-white border border-gray-300 rounded-md shadow-xl text-sm';
        div.style.width = '260px';
        div.style.zIndex = '70';
        div.innerHTML = `
            <div id="hwDragHandle" class="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 rounded-t-md bg-gray-50 cursor-move select-none" style="touch-action:none;">
                <svg class="w-4 h-4 text-gray-400 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg>
                <span class="text-gray-600 flex-1">${t.handwriteTitle}</span>
                <button type="button" id="hwPanelClose" class="p-0.5 rounded hover:bg-gray-200" aria-label="${t.close}">
                    <svg class="w-4 h-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="p-2">
            <div class="flex items-center gap-1 mb-2">
                <div class="flex rounded-md border border-gray-300 overflow-hidden" role="group">
                    <button type="button" data-tool="pen" class="hw-tool p-2 hover:bg-gray-100" title="${t.handwritePen}">
                        <svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"/></svg>
                    </button>
                    <button type="button" data-tool="highlighter" class="hw-tool p-2 hover:bg-gray-100 border-s border-gray-300" title="${t.handwriteHighlighter}">
                        <svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 11l6-6 4 4-6 6H9v-4z"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 21l3-1 1-3-3 1-1 3z"/></svg>
                    </button>
                    <button type="button" data-tool="eraser" class="hw-tool p-2 hover:bg-gray-100 border-s border-gray-300" title="${t.handwriteEraser}">
                        <svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20 20H9L4.5 15.5a2 2 0 010-2.828l8-8a2 2 0 012.828 0l4.5 4.5a2 2 0 010 2.828L13 18"/></svg>
                    </button>
                </div>
                <button type="button" id="hwUndo" title="${t.handwriteUndo}" class="p-2 rounded-md hover:bg-gray-100 ms-auto" disabled>
                    <svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L4 10l5-5M4 10h11a5 5 0 010 10h-1"/></svg>
                </button>
                <button type="button" id="hwRedo" title="${t.handwriteRedo}" class="p-2 rounded-md hover:bg-gray-100" disabled>
                    <svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 15l5-5-5-5M20 10H9a5 5 0 000 10h1"/></svg>
                </button>
                <button type="button" id="hwClear" title="${t.handwriteClear}" class="p-2 rounded-md hover:bg-gray-100">
                    <svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
                </button>
            </div>
            <div class="flex items-center gap-1 mb-2">
                ${swatches.map(c => `<button type="button" data-color="${c}" class="hw-swatch w-6 h-6 rounded-full border border-gray-300" style="background:${c}"></button>`).join('')}
                <label class="w-6 h-6 rounded-full border border-gray-300 overflow-hidden cursor-pointer relative" title="${t.handwriteColor}">
                    <input type="color" id="hwCustomColor" value="#000000" class="absolute -top-1 -left-1 w-8 h-8 cursor-pointer">
                </label>
            </div>
            <label class="flex items-center gap-2 text-gray-600 mb-2">
                ${t.handwriteSize}
                <input type="range" id="hwSize" min="1" max="40" value="3" class="flex-1 align-middle">
            </label>
            <p id="hwEmptyMsg" class="hidden text-red-600 mb-2">${t.handwriteEmpty}</p>
            <div class="flex justify-end gap-2">
                <button type="button" id="hwCancel" class="px-3 py-1.5 rounded-md bg-gray-200 text-sm font-medium hover:bg-gray-300">${t.cancel}</button>
                <button type="button" id="hwDone" class="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">${t.handwriteDone}</button>
            </div>
            </div>
        `;
        return div;
    }

    /**
     * @method createWatermarkMenu
     * @description The watermark panel: text, opacity, Apply and Remove. Applying sets one watermark for the
     * whole document - it shows on every existing page and on any page added afterward, since it is drawn fresh
     * each time pages are laid out (see updatePageGuides), not baked into any one page.
     */
    createWatermarkMenu() {
        const t = this.i18n;
        const div = document.createElement('div');
        div.id = 'watermarkMenu';
        div.className = 'hidden fixed bg-white border border-gray-300 rounded-md shadow-xl text-sm p-3';
        div.style.width = '240px';
        div.style.zIndex = '70';
        div.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h3 class="font-medium">${t.watermarkTitle}</h3>
                <button type="button" id="wmClose" class="p-0.5 rounded hover:bg-gray-100" aria-label="${t.close}">
                    <svg class="w-4 h-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <label class="block mb-2">
                <span class="block text-gray-600 mb-1">${t.watermarkTextLabel}</span>
                <input type="text" id="wmText" placeholder="${t.watermarkPlaceholder}" dir="${this.dir}" class="w-full border border-gray-300 rounded-md px-2 py-1">
            </label>
            <label class="flex items-center gap-2 text-gray-600 mb-3">
                ${t.watermarkOpacity}
                <input type="range" id="wmOpacity" min="0.05" max="0.5" step="0.01" class="flex-1 align-middle">
            </label>
            <div class="flex justify-end gap-2">
                <button type="button" id="wmRemove" class="px-3 py-1.5 rounded-md bg-gray-200 text-sm font-medium hover:bg-gray-300">${t.watermarkRemove}</button>
                <button type="button" id="wmApply" class="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">${t.watermarkApply}</button>
            </div>
        `;
        return div;
    }

    /** Saves the watermark (text, opacity, color, angle, size) so it survives a reload, the same way margins do. */
    saveWatermark() {
        if (!this.useLocalStorage) return;
        try { localStorage.setItem('jCaretWatermark', JSON.stringify(this.watermark)); } catch (_) { /* ignore quota errors */ }
    }

    /** Escapes text (the watermark's own words) before it is written into an HTML string. */
    _escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * @method startHandwriting
     * @description Opens the handwriting toolbar and lays a transparent, full-page-sized drawing overlay directly
     * on top of the document (the same technique the page-margin guides use), so the person draws straight onto
     * the page instead of into a separate box. Pen and highlighter draw; the eraser removes whole strokes it
     * touches. "Done" turns the strokes into one image, cropped to what was actually drawn, placed exactly where
     * it was drawn and left selected (so it can be dragged or realigned right away); "Cancel" discards them.
     */
    /** Restores an ink figure that editHandwriting() hid, if the edit is closed without clicking Done. */
    _hwCancelEdit() {
        if (this._hwEditingHidden) { this._hwEditingHidden.style.display = ''; this._hwEditingHidden = null; }
        this._hwEditingFigure = null;
    }
    startHandwriting(initialStrokes) {
        if (this._hwOpen) return;
        this._hwOpen = true;
        this.saveSelection();
        const menu = this.handwriteMenu;
        const editor = this.editor;
        editor.style.position = editor.style.position || 'relative';

        const overlay = document.createElement('canvas');
        overlay.className = 'jcaret-handwrite-overlay';
        overlay.setAttribute('contenteditable', 'false');
        const w = editor.scrollWidth, h = editor.scrollHeight;
        overlay.width = w;
        overlay.height = h;
        overlay.style.width = w + 'px';
        overlay.style.height = h + 'px';
        editor.appendChild(overlay);
        this._hwOverlay = overlay;
        const ctx = overlay.getContext('2d');

        const state = { tool: 'pen', color: '#000000', size: 3, strokes: (initialStrokes || []).slice(), redoStack: [], current: null };
        this._hwState = state;

        const setToolButtons = () => menu.querySelectorAll('.hw-tool').forEach(b => b.classList.toggle('bg-gray-200', b.dataset.tool === state.tool));
        const setSwatches = () => menu.querySelectorAll('.hw-swatch').forEach(b => {
            const on = b.dataset.color.toLowerCase() === state.color.toLowerCase();
            b.classList.toggle('ring-2', on);
            b.classList.toggle('ring-blue-500', on);
        });
        const setUndoRedo = () => {
            menu.querySelector('#hwUndo').disabled = state.strokes.length === 0;
            menu.querySelector('#hwRedo').disabled = state.redoStack.length === 0;
        };
        const redraw = () => {
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            state.strokes.forEach(s => this._hwDrawStroke(ctx, s));
        };
        const applyCursor = () => { overlay.style.cursor = state.tool === 'eraser' ? 'cell' : 'crosshair'; };

        const onTool = e => { state.tool = e.currentTarget.dataset.tool; applyCursor(); setToolButtons(); };
        const onSwatch = e => { state.color = e.currentTarget.dataset.color; if (state.tool === 'eraser') state.tool = 'pen'; setToolButtons(); setSwatches(); menu.querySelector('#hwCustomColor').value = state.color; };
        const onCustomColor = e => { state.color = e.target.value; if (state.tool === 'eraser') state.tool = 'pen'; setToolButtons(); setSwatches(); };
        const onSize = e => { state.size = parseFloat(e.target.value) || 1; };

        menu.querySelectorAll('.hw-tool').forEach(b => b.addEventListener('click', onTool));
        menu.querySelectorAll('.hw-swatch').forEach(b => b.addEventListener('click', onSwatch));
        menu.querySelector('#hwCustomColor').addEventListener('input', onCustomColor);
        menu.querySelector('#hwSize').addEventListener('input', onSize);

        const pointFromEvent = e => {
            const r = overlay.getBoundingClientRect();
            const k = overlay.width / r.width;
            const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
            return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, p: pressure };
        };
        const hitStroke = (pt, radius) => state.strokes.findIndex(s => s.points.some(q => Math.hypot(q.x - pt.x, q.y - pt.y) < radius));

        const onPointerDown = e => {
            e.preventDefault();
            overlay.setPointerCapture(e.pointerId);
            const pt = pointFromEvent(e);
            if (state.tool === 'eraser') {
                const radius = Math.max(14, state.size * 3);
                let idx;
                while ((idx = hitStroke(pt, radius)) !== -1) state.strokes.splice(idx, 1);
                state.redoStack = [];
                redraw();
                setUndoRedo();
                state.current = { erasing: true, radius };
                return;
            }
            state.current = {
                tool: state.tool,
                color: state.color,
                size: state.tool === 'highlighter' ? Math.max(state.size * 2.5, 14) : state.size,
                opacity: state.tool === 'highlighter' ? 0.35 : 1,
                points: [pt]
            };
        };
        const onPointerMove = e => {
            if (!state.current) return;
            e.preventDefault();
            const pt = pointFromEvent(e);
            if (state.current.erasing) {
                let idx;
                while ((idx = hitStroke(pt, state.current.radius)) !== -1) state.strokes.splice(idx, 1);
                redraw();
                return;
            }
            state.current.points.push(pt);
            redraw();
            this._hwDrawStroke(ctx, state.current);
        };
        const endStroke = e => {
            if (!state.current) return;
            try { overlay.releasePointerCapture(e.pointerId); } catch (_) {}
            if (!state.current.erasing && state.current.points.length > 1) {
                state.strokes.push(state.current);
                state.redoStack = [];
            }
            state.current = null;
            redraw();
            setUndoRedo();
        };
        overlay.addEventListener('pointerdown', onPointerDown);
        overlay.addEventListener('pointermove', onPointerMove);
        overlay.addEventListener('pointerup', endStroke);
        overlay.addEventListener('pointercancel', endStroke);
        overlay.addEventListener('pointerleave', e => { if (state.current && !state.current.erasing) endStroke(e); });

        menu.querySelector('#hwUndo').addEventListener('click', () => { if (!state.strokes.length) return; state.redoStack.push(state.strokes.pop()); redraw(); setUndoRedo(); });
        menu.querySelector('#hwRedo').addEventListener('click', () => { if (!state.redoStack.length) return; state.strokes.push(state.redoStack.pop()); redraw(); setUndoRedo(); });
        menu.querySelector('#hwClear').addEventListener('click', () => { state.strokes = []; state.redoStack = []; redraw(); setUndoRedo(); });

        const cleanupHandlers = [
            [menu.querySelector('#hwUndo'), 'click'], [menu.querySelector('#hwRedo'), 'click'], [menu.querySelector('#hwClear'), 'click']
        ];
        menu.querySelectorAll('.hw-tool').forEach(b => cleanupHandlers.push([b, 'click']));
        menu.querySelectorAll('.hw-swatch').forEach(b => cleanupHandlers.push([b, 'click']));

        const finish = insert => {
            this._hwOpen = false;
            overlay.remove();
            this._hwOverlay = null;
            menu.classList.add('hidden');
            if (state.strokes.length) {
                // something is left to keep, one way or another
                if (insert) this._finishHandwriting(state.strokes, overlay.width, overlay.height);
                else this._hwCancelEdit();   // discard the edit, restore the original exactly as it was
            } else if (this._hwEditingFigure) {
                // editing an existing drawing and it has been erased down to nothing: delete it for good, whether
                // this was closed with Done or just closed - bringing it back would undo an erase the person just did
                const oldContent = this.snapshot();
                this._hwEditingFigure.remove();
                this._hwEditingHidden = null;
                this._hwEditingFigure = null;
                this.selectedResizable = null;
                this.pushUndoState(oldContent);
                this.updateToolbarState();
            }
            // a brand-new drawing (no existing figure) with nothing drawn simply has nothing to insert or delete
            this._hwState = null;
        };
        this._hwFinish = finish;
        menu.querySelector('#hwDone').onclick = () => {
            if (!state.strokes.length && !this._hwEditingFigure) { menu.querySelector('#hwEmptyMsg').classList.remove('hidden'); return; }
            finish(true);
        };
        menu.querySelector('#hwCancel').onclick = () => finish(false);

        menu.querySelector('#hwEmptyMsg').classList.add('hidden');
        menu.querySelector('#hwSize').value = 3;
        menu.querySelector('#hwCustomColor').value = '#000000';
        setToolButtons(); setSwatches(); setUndoRedo(); applyCursor();
        redraw();
    }

    /** Draws one stroke with its own tool/color/size/opacity onto ctx (see startHandwriting / _hwBuffer). */
    _hwDrawStroke(ctx, s) {
        if (s.points.length < 2) return;
        const target = s.opacity < 1 ? this._hwBuffer(ctx.canvas.width, ctx.canvas.height) : ctx;
        if (s.opacity < 1) target.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        target.save();
        target.strokeStyle = s.color;
        target.lineCap = 'round';
        target.lineJoin = 'round';
        target.beginPath();
        target.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
            const b = s.points[i];
            const w = s.tool === 'highlighter' ? s.size : Math.max(1, s.size * (0.5 + (b.p || 0.5)));
            target.lineWidth = w;
            target.lineTo(b.x, b.y);
            target.stroke();
            target.beginPath();
            target.moveTo(b.x, b.y);
        }
        target.restore();
        if (s.opacity < 1) {
            ctx.save();
            ctx.globalAlpha = s.opacity;
            ctx.drawImage(target.canvas, 0, 0);
            ctx.restore();
        }
    }
    /** A reusable offscreen canvas/context for compositing a translucent stroke without it darkening itself. */
    _hwBuffer(w, h) {
        if (!this._hwBufferCanvas) this._hwBufferCanvas = document.createElement('canvas');
        const c = this._hwBufferCanvas;
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        return c.getContext('2d');
    }

    /**
     * @method _finishHandwriting
     * @description Crops the drawing to what was actually drawn (with a little padding) and inserts it as a
     * floating image at exactly that spot on the page: draggable to move it anywhere, resizable via its handle
     * like any image, and alignable (left/center/right/full snaps it to that page's margin, full stretches it to
     * the page's text width) while keeping the position it is dragged to vertically.
     */
    _finishHandwriting(strokes, canvasW, canvasH) {
        this._commitHandwriting(strokes, canvasW, canvasH, this._hwEditingFigure || null);
        this._hwEditingFigure = null;
    }

    /**
     * @method _commitHandwriting
     * @description Crops to what was actually drawn (with a little padding) and stores it as a LIVE, still-editable
     * ink figure - a <canvas>, not a flattened <img> - with the strokes themselves kept as data (figure.dataset.ink)
     * so it can be reopened and erased or added to later (double-click it). With an existingFigure (editing an ink
     * that was already on the page), that same figure is updated in place instead of a new one being created.
     */
    _commitHandwriting(strokes, canvasW, canvasH, existingFigure) {
        const pad = 8;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        strokes.forEach(s => s.points.forEach(p => {
            const half = (s.tool === 'highlighter' ? s.size : s.size * 1.5) / 2 + pad;
            minX = Math.min(minX, p.x - half); maxX = Math.max(maxX, p.x + half);
            minY = Math.min(minY, p.y - half); maxY = Math.max(maxY, p.y + half);
        }));
        minX = Math.max(0, minX); minY = Math.max(0, minY);
        maxX = Math.min(canvasW, maxX); maxY = Math.min(canvasH, maxY);
        const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);

        // strokes are stored in CROP-LOCAL coordinates, so the ink still lines up if the figure is later moved
        const localStrokes = strokes.map(s => ({ ...s, points: s.points.map(p => ({ x: p.x - minX, y: p.y - minY, p: p.p })) }));

        const oldContent = this.snapshot();
        const figure = existingFigure || document.createElement('figure');
        figure.className = 'resizable floating ink';
        figure.contentEditable = 'false';
        figure.style.cssText = `position:absolute; left:${Math.round(minX)}px; top:${Math.round(minY)}px; width:${Math.round(w)}px; z-index:6;`;
        figure.title = this.i18n.handwriteEditHint;
        figure.dataset.ink = JSON.stringify(localStrokes);
        figure.dataset.inkW = String(Math.round(w));
        figure.dataset.inkH = String(Math.round(h));

        let canvas = figure.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.style.cssText = 'display:block; width:100%; height:auto; pointer-events:none;';
            figure.appendChild(canvas);
        }
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext('2d');
        localStrokes.forEach(s => this._hwDrawStroke(ctx, s));

        if (!existingFigure) this.editor.appendChild(figure);
        // same reason as the image-upload path: give the editor real keyboard focus so Delete/Backspace work
        // immediately, without the person having to click the page first just to re-establish a selection
        this.editor.focus();
        this.addResizeHandle(figure);
        // it was placed exactly where it was drawn - which, drawn right up against the very edge of the sheet,
        // can already sit off the page before it is ever dragged or rotated at all; settle it the same way a
        // drag would - free to sit anywhere on the page, margins included, never off the sheet itself
        this._keepFloatingInBounds(figure, false, true);
        this.selectedResizable = figure;
        this.pushUndoState(oldContent);
        this.updateToolbarState();
    }

    /**
     * @method editHandwriting
     * @description Reopens an existing ink figure for editing: its strokes are loaded back into the drawing
     * overlay at their original page position, the figure itself is hidden while editing, and "Done" updates that
     * same figure in place (so it can be erased, or added to, without turning it into a fresh image each time).
     */
    editHandwriting(figure) {
        let strokes = [];
        try { strokes = JSON.parse(figure.dataset.ink || '[]'); } catch (_) { strokes = []; }
        const left = parseFloat(figure.style.left) || 0, top = parseFloat(figure.style.top) || 0;
        const pageStrokes = strokes.map(s => ({ ...s, points: s.points.map(p => ({ x: p.x + left, y: p.y + top, p: p.p })) }));
        figure.style.display = 'none';
        this._hwEditingFigure = figure;
        this._hwEditingHidden = figure;
        if (this.handwriteMenu.classList.contains('hidden')) {
            const r = this.handwriteButton.getBoundingClientRect();
            if (!this._hwPositioned) {
                this.handwriteMenu.style.left = `${r.left}px`;
                this.handwriteMenu.style.top = `${r.bottom + 4}px`;
                this._hwPositioned = true;
            }
            this.handwriteMenu.classList.remove('hidden');
        }
        this.startHandwriting(pageStrokes);
    }

    /**
     * @method _rehydrateInk
     * @description A canvas's drawn pixels are never part of its HTML - saving to localStorage (or any other
     * innerHTML-based save) keeps figure.dataset.ink (the actual stroke data) but not what was drawn, so after a
     * reload each ink figure's canvas comes back blank. This redraws every ink figure under root from that stored
     * stroke data, right after such content is loaded back in.
     */
    _rehydrateInk(root) {
        root.querySelectorAll('figure.ink[data-ink]').forEach(figure => {
            const canvas = figure.querySelector('canvas');
            if (!canvas) return;
            let strokes = [];
            try { strokes = JSON.parse(figure.dataset.ink); } catch (_) { return; }
            const w = parseInt(figure.dataset.inkW, 10) || canvas.width || 1;
            const h = parseInt(figure.dataset.inkH, 10) || canvas.height || 1;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            strokes.forEach(s => this._hwDrawStroke(ctx, s));
        });
    }

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
        const kbd = 'px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-sans text-gray-500 font-semibold shadow-sm';
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
                            <kbd class="${kbd}">Shift</kbd>
                            <span class="text-gray-400 text-xs">+</span>
                            <kbd class="${kbd}">Enter</kbd>
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">${this.i18n.forEnlarge}</span>
                        <div class="flex items-center gap-1" dir="ltr">
                            <kbd class="${kbd}">Ctrl</kbd>
                            <span class="text-gray-400 text-xs">+</span>
                            <kbd class="${kbd}">+</kbd>
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">${this.i18n.forShrink}</span>
                        <div class="flex items-center gap-1" dir="ltr">
                            <kbd class="${kbd}">Ctrl</kbd>
                            <span class="text-gray-400 text-xs">+</span>
                            <kbd class="${kbd}">-</kbd>
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">${this.i18n.forTab}</span>
                        <kbd class="${kbd}">Tab</kbd>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">${this.i18n.forDelete}</span>
                        <kbd class="${kbd}">Delete</kbd>
                    </div>
                </div>
                <div class="flex justify-between gap-2 mt-6 pt-4 border-t border-gray-100">
                    <p style="margin-top: 10px;"><a href="https://www.auktubli.com" target="blank" style="color: #007bff;">${this.i18n.by}</a></p><button id="closeInfo" class="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">${this.i18n.ok || 'OK'}</button>
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
        * @method createClearAllModal
        * @description Confirmation for "Clear All" - a real modal matching the rest of the editor's own look,
        * instead of the browser's plain confirm() dialog. Confirming also removes the watermark, since a full
        * clear starting a document over should not leave one behind.
        */
    createClearAllModal() {
        const div = document.createElement('div');
        div.id = 'clearAllModal';
        div.className = 'hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
        div.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" dir="${this.dir}">
                <h3 class="text-lg font-medium mb-4">${this.i18n.clearAllTitle}</h3>
                <p>${this.i18n.clearAllConfirm}</p>
                <div class="flex justify-end gap-2 mt-4">
                    <button id="cancelClearAll" class="px-4 py-2 rounded-md bg-gray-200 text-sm font-medium hover:bg-gray-300">${this.i18n.cancel}</button>
                    <button id="confirmClearAll" class="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700">${this.i18n.clearAllOk}</button>
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
        if (!selection.rangeCount) return null;
        let node = selection.anchorNode;
        if (node.nodeType === 3) {
            node = node.parentNode;
        }
        if (node.getAttribute('contenteditable') === 'true') {
            return 'ROOT';
        }
        return node.tagName;
    }
    /**
        * @method getNextBlockElement
        * @description Returns next line element where caret is.
        */
    getNextBlockElement() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        let currentNode = selection.anchorNode;
        const editor = this.editor;
        if (!editor.contains(currentNode)) return null;
        while (currentNode && currentNode.parentNode !== editor) {
            currentNode = currentNode.parentNode;
        }
        const nextElement = currentNode.nextElementSibling;
        if (nextElement) {
            return nextElement.tagName;
        } else {
            return 'NOTHING';
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
                this.highlightBar.style.backgroundColor = this.currentHighlightColor === 'transparent' ? 'transparent' : this.currentHighlightColor;
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
            const oldContent = this.snapshot();
            const reader = new FileReader();
            reader.onload = ev => {
                const tempImg = new Image();
                tempImg.src = ev.target.result;
                tempImg.onload = () => {
                    const canvas = document.createElement('canvas');

                    // 1. INCREASE MAX WIDTH (quality vs. size balance)
                    const maxWidth = 1200;

                    let width = tempImg.width;
                    let height = tempImg.height;

                    // Calculate new dimensions keeping aspect ratio
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');

                    // 2. ENABLE SMOOTH SCALING
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    ctx.drawImage(tempImg, 0, 0, width, height);

                    // 3. OPTIMIZE COMPRESSION FORMAT AND QUALITY
                    let compressedSrc = canvas.toDataURL('image/webp', 0.75);

                    // Fallback: If WebP isn't supported or returns a larger string (rare), use JPEG at 0.7
                    if (compressedSrc.length > ev.target.result.length && tempImg.src.startsWith('data:image/jpeg')) {
                        compressedSrc = canvas.toDataURL('image/jpeg', 0.7);
                    }

                    // A floating figure - draggable, resizable and alignable, placed near where the caret was.
                    const editorRect = this.editor.getBoundingClientRect();
                    let left = 40, top = 40;
                    try {
                        const sel = window.getSelection();
                        if (sel.rangeCount) {
                            const r = sel.getRangeAt(0).getBoundingClientRect();
                            if (r.width || r.height) { left = r.left - editorRect.left; top = r.top - editorRect.top; }
                        }
                    } catch (_) { /* keep the default position */ }
                    const maxW = 400;
                    const w = Math.min(maxW, width);
                    left = Math.max(0, Math.min(left, this.editor.clientWidth - w));
                    top = Math.max(0, top);

                    const figure = document.createElement('figure');
                    figure.className = 'resizable floating';
                    figure.contentEditable = 'false';
                    figure.style.cssText = `position:absolute; left:${Math.round(left)}px; top:${Math.round(top)}px; width:${Math.round(w)}px; z-index:6;`;

                    const img = document.createElement('img');
                    img.src = compressedSrc;
                    img.alt = 'Uploaded Image';
                    img.style.cssText = 'display:block; width:100%; height:auto; pointer-events:none;';
                    figure.appendChild(img);

                    const figcaption = document.createElement('figcaption');
                    figcaption.className = 'caption';
                    figcaption.contentEditable = 'true';
                    figcaption.textContent = this.i18n.caption;
                    figure.appendChild(figcaption);

                    this.editor.appendChild(figure);
                    // the editor must actually hold keyboard focus, or a Delete/Backspace right after inserting
                    // this - with no text caret placed anywhere yet - would have nowhere to be delivered to at all
                    this.editor.focus();
                    this.addResizeHandle(figure);
                    // it landed near the caret, which could already be off the page (a large image, say) - settle
                    // it the same way a drag would: free to sit anywhere on the page, margins included, never
                    // off the sheet itself
                    this._keepFloatingInBounds(figure, false, true);
                    this.selectedResizable = figure;

                    this.pushUndoState(oldContent);
                    this.updateToolbarState();
                    this.imageUpload.value = '';
                };
            };

            reader.readAsDataURL(file);
        });
        this.handwriteButton.addEventListener('click', e => {
            e.preventDefault();
            const opening = this.handwriteMenu.classList.contains('hidden');
            this.handwriteMenu.classList.toggle('hidden');
            if (opening) {
                // first open: place it just under the button; a drag moves it anywhere, even outside the page
                if (!this._hwPositioned) {
                    const r = this.handwriteButton.getBoundingClientRect();
                    const menuW = 260;
                    let left = r.left;
                    if (left + menuW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuW - 8);
                    this.handwriteMenu.style.left = `${left}px`;
                    this.handwriteMenu.style.top = `${r.bottom + 4}px`;
                    this._hwPositioned = true;
                }
                this.startHandwriting();
            }
            else if (this._hwOpen && this._hwFinish) { this.handwriteMenu.classList.remove('hidden'); this._hwFinish(false); }
        });
        this.handwriteMenu.querySelector('#hwPanelClose').addEventListener('click', () => {
            if (this._hwOpen && this._hwFinish) this._hwFinish(false);
            else this.handwriteMenu.classList.add('hidden');
        });
        // Drag the floating panel by its header - it can be moved anywhere on screen, including outside the page.
        (() => {
            const handle = this.handwriteMenu.querySelector('#hwDragHandle');
            let sx = 0, sy = 0, ol = 0, ot = 0, dragging = false;
            const move = e => {
                if (!dragging) return;
                const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
                this.handwriteMenu.style.left = `${ol + (cx - sx)}px`;
                this.handwriteMenu.style.top = `${ot + (cy - sy)}px`;
            };
            const end = () => {
                dragging = false;
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', end);
            };
            handle.addEventListener('pointerdown', e => {
                e.preventDefault();
                dragging = true;
                sx = e.clientX; sy = e.clientY;
                ol = parseFloat(this.handwriteMenu.style.left) || 0;
                ot = parseFloat(this.handwriteMenu.style.top) || 0;
                document.addEventListener('pointermove', move);
                document.addEventListener('pointerup', end);
            });
        })();
        // Watermark button + panel
        this.watermarkButton.addEventListener('click', e => {
            e.preventDefault();
            const opening = this.watermarkMenu.classList.contains('hidden');
            this.watermarkMenu.classList.toggle('hidden');
            if (opening) {
                const r = this.watermarkButton.getBoundingClientRect();
                const menuW = 240;
                let left = r.left;
                if (left + menuW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuW - 8);
                this.watermarkMenu.style.left = `${left}px`;
                this.watermarkMenu.style.top = `${r.bottom + 4}px`;
                this.watermarkMenu.querySelector('#wmText').value = this.watermark.text;
                this.watermarkMenu.querySelector('#wmOpacity').value = this.watermark.opacity;
            }
        });
        this.watermarkMenu.querySelector('#wmClose').addEventListener('click', () => this.watermarkMenu.classList.add('hidden'));
        this.watermarkMenu.addEventListener('input', e => {
            if (e.target.id === 'wmOpacity') this.watermark.opacity = parseFloat(e.target.value) || 0.15;
        });
        this.watermarkMenu.querySelector('#wmApply').addEventListener('click', () => {
            this.watermark.text = this.watermarkMenu.querySelector('#wmText').value.trim();
            this.watermark.opacity = parseFloat(this.watermarkMenu.querySelector('#wmOpacity').value) || 0.15;
            this.saveWatermark();
            if (this.schedulePageGuides) this.schedulePageGuides();
            this.watermarkMenu.classList.add('hidden');
        });
        this.watermarkMenu.querySelector('#wmRemove').addEventListener('click', () => {
            this.watermark.text = '';
            this.watermarkMenu.querySelector('#wmText').value = '';
            this.saveWatermark();
            if (this.schedulePageGuides) this.schedulePageGuides();
            this.watermarkMenu.classList.add('hidden');
        });
        this.fontNameContainer.addEventListener('mousedown', () => this.saveSelection());
        this.fontNameContainer.addEventListener('change', () => {
            const oldContent = this.snapshot();
            if (this.fontNameValue) {
                this.editor.focus();
                this.restoreSelection();
                document.execCommand('fontName', false, this.fontNameValue);
                this.pushUndoState(oldContent);
                this.updateToolbarState();
            }
        });
        this.fontSizeSelect.addEventListener('mousedown', () => this.saveSelection());
        this.fontSizeSelect.addEventListener('change', () => {
            const oldContent = this.snapshot();
            if (this.fontSizeSelect.value) {
                this.editor.focus();
                this.restoreSelection();
                const value = this.fontSizeSelect.value;
                if (value <= 7) {
                    document.execCommand('fontSize', false, value);
                }
                this.pushUndoState(oldContent);
                this.updateToolbarState();
            }
        });

        this.foreColorLabel.addEventListener('mousedown', () => this.saveSelection());
        this.fontColorInput.addEventListener('mousedown', () => this.saveSelection());
        // (registered ONCE here - it used to be re-registered on every toolbar refresh)
        this.fontColorInput.addEventListener('input', () => {
            this.foreColorBar.style.backgroundColor = this.fontColorInput.value;
        });
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
            const oldContent = this.snapshot();
            let changed = false;
            if (cmd === 'showInfo'){
                this.infoModal.classList.remove("hidden");
            } else if (cmd === 'printPdf') {
                this.printAsPDF();
            } else if (cmd === 'addPage') {
                this.addPage();
                return;
            } else if (cmd === 'pageMargins') {
                this.openMarginPanel(this._currentPage);
                return;
            } else if (cmd === 'undo') {
                if (this.undoStack.length > 0) {
                    this.redoStack.push(this.snapshot());
                    this.editor.innerHTML = this.undoStack.pop();
                    this.selectedResizable = null;
                    this.lastContent = this.snapshot();
                    this.saveAll();
                    changed = true;
                }
            } else if (cmd === 'redo') {
                if (this.redoStack.length > 0) {
                    this.undoStack.push(this.snapshot());
                    this.editor.innerHTML = this.redoStack.pop();
                    this.selectedResizable = null;
                    this.lastContent = this.snapshot();
                    this.saveAll();
                    changed = true;
                }
            } else if (cmd === 'backColor') {
                const cur = document.queryCommandValue('backColor').toLowerCase();
                const on = (cur === 'rgb(255, 255, 0)' || cur === '#ffff00');
                document.execCommand(cmd, false, on ? 'transparent' : val);
                changed = true;
            } else if (cmd === 'clearAll') {
                this.clearAllModal.classList.remove('hidden');
                return;   // the modal's own buttons decide what happens next, not the generic 'changed' handling below
            } else if (cmd === 'createLink') {
                if (this.savedRange && this.savedRange.toString().length) {
                    this.linkModal.classList.remove('hidden');
                    this.linkModal.querySelector('#linkUrl').value = 'https://';
                    this.linkModal.querySelector('#linkUrl').focus();
                }
            } else if (cmd === 'codeBlock') {
                changed = this.toggleCode();
            } else if (cmd === 'insertBlockquote') {
                if(this.language === 'en' && this.alignmentMenu.querySelector('button[data-command="justifyRight"]').classList.contains('is-active')) return;
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
                if(this.language === 'ar') this.updateDirections();
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

                        if (this.language === "en" && ((currentDir === "rtl" || direction === "rtl"))) {
                            return;
                        }
                    }
                }
                document.execCommand(cmd, false, null);
                // FIX (multi-line selection): the browser wraps every selected line in ONE new <ul>/<ol>, but the
                // common ancestor of the selection is then the list (or the editor), not an <li>, so the old code
                // never gave the list a direction and no padding was applied. Now every list touched by the
                // selection is handled, and the CSS also indents lists that have no dir attribute at all.
                const afterSel = window.getSelection();
                if (afterSel.rangeCount) {
                    const range = afterSel.getRangeAt(0);
                    this.editor.querySelectorAll('ul, ol').forEach(list => {
                        let touched = false;
                        try { touched = range.intersectsNode(list); } catch (_) {}
                        if (touched && !list.getAttribute('dir')) list.dir = currentDir;
                    });
                    let n = afterSel.anchorNode;
                    if (n && n.nodeType !== 1) n = n.parentElement;
                    const li = n && n.closest ? n.closest('li') : null;
                    if (li && li.innerHTML === '') li.innerHTML = '<br>';
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
                                this.applyFigureAlignment(this.selectedResizable, cmd);
                                if (cmd === 'justifyLeft') td.focus();
                                this.pushUndoState(oldContent);
                            }
                        } else {
                            // Apply to the selected content in the cell. Done by hand: execCommand silently does nothing
                            // for "left" after "center" / "right" here (the cell's default alignment already counts as left).
                            this.alignCellContent(td, sel.getRangeAt(0), cmd);
                            this.pushUndoState(oldContent);
                        }
                        this.updateToolbarState();
                        return;
                    }
                }
                if (this.selectedResizable) {
                    this.applyFigureAlignment(this.selectedResizable, cmd);
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
                    delete table.dataset.jcNaturalW;   // column count is changing: the cached natural width is stale
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
                    delete table.dataset.jcNaturalW;
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
            if (changed && cmd !== 'undo' && cmd !== 'redo' && this.snapshot() !== oldContent) {
                this.undoStack.push(oldContent);
                this.redoStack = [];
                this.lastContent = this.snapshot();
                this.saveAll();
            }
            this.updateToolbarState();
        });
        this.linkModal.querySelector('#saveLink').addEventListener('click', () => {
            this.linkModal.classList.add('hidden');
            const url = this.linkModal.querySelector('#linkUrl').value.trim();
            const oldContent = this.snapshot();
            if (url && this.savedRange) {
                this.editor.focus();
                this.restoreSelection();
                document.execCommand('createLink', false, this.normalizeUrl(url));
                this.pushUndoState(oldContent);
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
                    tableHTML += '<td contenteditable="true" style="min-height:30px;"><br></td>';
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
            const nowContent = this.snapshot();
            if (nowContent !== this.lastContent) {
                this.undoStack.push(this.lastContent);
                this.redoStack = [];
                this.lastContent = nowContent;
                this.saveAll();
            }
            this.justifyFullBtn.style.display = "none";
            this.updateToolbarState();
        });
        // When a list is switched OFF the browser leaves stray <span>s behind - unwrap them and park the caret at the end.
        [this.uListBtn, this.oListBtn].forEach(listBtn => {
            listBtn.addEventListener('click', () => {
                // is-active here means we are about to turn the list OFF
                if (!listBtn.classList.contains('is-active')) return;
                setTimeout(() => {
                    const selection = window.getSelection();
                    if (!selection.rangeCount) return;
                    let node = selection.anchorNode;
                    if (!node) return;
                    if (node.nodeType === 3) node = node.parentNode;
                    // the list is gone now, so look for the P
                    const pElement = node.closest ? node.closest('p') : null;
                    if (pElement) {
                        pElement.querySelectorAll('span').forEach(span => {
                            span.replaceWith(...span.childNodes);
                        });
                        pElement.normalize();
                        const range = document.createRange();
                        range.setStart(pElement, pElement.childNodes.length);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }, 0);
            });
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
        this.printTipModal.querySelector('#cancelPrintTip').addEventListener('click', () => {
            this.printTipModal.classList.add('hidden');
        });
        this.printTipModal.addEventListener('click', e => {
            if (e.target === this.printTipModal) this.printTipModal.classList.add('hidden');
        });
        this.printTipModal.querySelector('#continuePrintTip').addEventListener('click', () => {
            if (this.printTipModal.querySelector('#printTipDontShow').checked) {
                try { localStorage.setItem('jCaretPrintTipHidden', '1'); } catch (_) { /* private mode - ignore */ }
            }
            this.printTipModal.classList.add('hidden');
            this._printNow();
        });
        this.printEmptyModal.querySelector('#closePrintEmpty').addEventListener('click', () => {
            this.printEmptyModal.classList.add('hidden');
        });
        this.printEmptyModal.addEventListener('click', e => {
            if (e.target === this.printEmptyModal) this.printEmptyModal.classList.add('hidden');
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
        this.clearAllModal.querySelector('#cancelClearAll').addEventListener('click', () => {
            this.clearAllModal.classList.add('hidden');
            this.editor.focus();
        });
        this.clearAllModal.addEventListener('click', e => {
            if (e.target === this.clearAllModal) this.clearAllModal.classList.add('hidden');
        });
        this.clearAllModal.querySelector('#confirmClearAll').addEventListener('click', () => {
            this.clearAllModal.classList.add('hidden');
            this.performClearAll();
        });
        let isFormatting = false; // The Lock
        this.editor.addEventListener('input', (event) => {
            if (isFormatting) {
                return;
            }
            isFormatting = true;
            try {
                // "Empty" = no text at all, one block only (extra blocks are pages added with "Add page"), no image / table.
                // Non-breaking spaces (what Tab inserts) count as content: String.trim() would wrongly remove them.
                const isEmpty = !/[^ \t\r\n]/.test(this.editor.textContent) &&
                    this.editor.children.length <= 1 && !this.editor.querySelector('img, table, figure');
                if (isEmpty) {
                    setTimeout(() => { // Queue asynchronously to avoid recursion
                        document.execCommand('foreColor', false, '#000000');
                        this.fontColorInput.value = "#000000";
                        this.foreColorBar.style.backgroundColor = "#000000";
                        document.execCommand('backColor', false, '#ffffff');
                        this.highlightBar.style.backgroundColor = '#ffffff';
                        document.execCommand('fontName', false, '');
                        document.execCommand('fontSize', false, '3');
                        document.execCommand('removeFormat', false, null);
                        const p = this.editor.querySelector('p');
                        if (!(p && p.children.length === 1 && p.querySelector('br'))) {
                            this.editor.innerHTML = '<p><br></p>';
                        }
                    }, 0);
                }
                this.updateToolbarState();
                this.debouncedPush();
                this.saveAll();
                this._scheduleCodeHighlight();
            } finally {
                isFormatting = false;
            }
        });
        this.editor.addEventListener('click', () => this.saveAll());
        this.editor.addEventListener('keyup', () => this.updateToolbarState());
        this.editor.addEventListener('mouseup', () => this.updateToolbarState());
        document.addEventListener('selectionchange', () => this.updateToolbarState());
        this.editor.addEventListener('click', e => {
            if (e.target.tagName.toLowerCase() === 'a' && e.target.getAttribute('href')) {
                window.open(this.normalizeUrl(e.target.getAttribute('href')), '_blank', 'noopener');
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
                this.justifyFullBtn.style.display = "none";
            } else {
                this.justifyFullBtn.style.display = "block";
                this.selectedResizable = null;
            }
            this.updateToolbarState();
        });
        // Double-clicking a handwriting drawing reopens it for editing (add to it, or erase part of it) -
        // it stays the same live figure, never turning into a flattened image.
        this.editor.addEventListener('dblclick', e => {
            const ink = e.target.closest('.resizable.floating.ink');
            if (ink) { e.preventDefault(); this.editHandwriting(ink); }
        });
        // Clicks that land on a margin / page gap must never leave a stray caret there
        this.editor.addEventListener('mousedown', e => this.onEditorMouseDown(e));
        document.addEventListener('mousedown', e => this.onMouseDown(e));
        document.addEventListener('touchstart', e => this.onTouchStart(e), { passive: false });
        this.editor.addEventListener('keydown', e => this.onKeyDown(e));
        this.editor.addEventListener('blur', () => {
            this.fontSizeSelect.selectedIndex = 0;
        });
    }
    /**
     * @method alignCellContent
     * @description Aligns the text of a table cell: every block of the cell touched by the selection gets the
     * alignment (or the cell itself when it holds bare text).
     */
    alignCellContent(td, range, cmd) {
        const value = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' }[cmd];
        if (!value) return;
        const blocks = Array.from(td.querySelectorAll('p, div, li, blockquote, h1, h2, h3, h4, h5, h6'))
            .filter(b => b.closest('td') === td && range.intersectsNode(b));
        const targets = blocks.length ? blocks : [td];
        targets.forEach(el => {
            el.style.textAlign = value;
            // stray "text-align: initial" spans left by the browser must not fight the new value
            el.querySelectorAll('span[style*="text-align"]').forEach(sp => {
                sp.style.removeProperty('text-align');
                if (!sp.getAttribute('style')) sp.removeAttribute('style');
            });
        });
    }

    /**
     * @method applyFigureAlignment
     * @description Aligns an image/table figure (shared by the "table cell" and "figure selected" paths).
     */
    applyFigureAlignment(fig, cmd) {
        if (fig.classList.contains('floating')) { this._alignFloatingFigure(fig, cmd); return; }
        const wasFull = fig.classList.contains('full');
        const willBeFull = cmd === 'justifyFull';
        if (!wasFull && willBeFull) {
            const currentWidth = fig.style.width || getComputedStyle(fig).width;
            fig.setAttribute('data-resize-width', currentWidth);
        }
        fig.classList.remove('left', 'center', 'right', 'full');
        if (cmd === 'justifyLeft') fig.classList.add('right');
        else if (cmd === 'justifyCenter') fig.classList.add('center');
        else if (cmd === 'justifyRight') fig.classList.add('left');
        else if (cmd === 'justifyFull') fig.classList.add('full');
        if (willBeFull) {
            fig.style.width = '100%';
        } else if (wasFull && !willBeFull) {
            const storedWidth = fig.getAttribute('data-resize-width');
            fig.style.width = storedWidth ? storedWidth : '';
        }
        this.removeResizeHandles(fig);
        this.addResizeHandle(fig);
    }

    /**
     * @method _alignFloatingFigure
     * @description Alignment for a floating (draggable) figure: left/center/right snaps its LEFT edge to that
     * page's margin or centers it, full stretches it to the page's text width - all while leaving its dragged
     * vertical position (top) exactly where it is.
     */
    _alignFloatingFigure(fig, cmd) {
        const MM = jCaret.MM, P = jCaret.PAGE_H * MM, S = P + jCaret.PAGE_GAP;
        const top = parseFloat(fig.style.top) || 0;
        const k = Math.max(0, Math.floor(top / S));
        const m = this.getPageMargins(k);
        const ml = m.left * MM, mr = m.right * MM;
        const editorW = this.editor.clientWidth;
        const wasFull = fig.classList.contains('full');
        fig.classList.remove('left', 'center', 'right', 'full');
        if (cmd === 'justifyFull') {
            if (!wasFull) fig.setAttribute('data-resize-width', fig.style.width || `${fig.offsetWidth}px`);
            fig.classList.add('full');
            fig.style.width = `${Math.max(50, editorW - ml - mr)}px`;
            fig.style.left = `${ml}px`;
        } else {
            if (wasFull) {
                const storedWidth = fig.getAttribute('data-resize-width');
                if (storedWidth) fig.style.width = storedWidth;
            }
            const w = fig.offsetWidth;
            if (cmd === 'justifyLeft') { fig.classList.add('left'); fig.style.left = `${ml}px`; }
            else if (cmd === 'justifyRight') { fig.classList.add('right'); fig.style.left = `${Math.max(ml, editorW - mr - w)}px`; }
            else { fig.classList.add('center'); fig.style.left = `${Math.max(ml, (editorW - w) / 2)}px`; }
        }
        this.removeResizeHandles(fig);
        this.addResizeHandle(fig);
        this._keepFloatingInBounds(fig, true);
    }

    // =====================================================================
    //  PAGE SYSTEM  (A4 sheets, per-page margins, automatic pages)
    // =====================================================================

    /**
     * @method getPageMargins
     * @description Margins (mm) of a page: its own override, or the defaults.
     */
    getPageMargins(i) {
        const m = Object.assign({}, this.defaultMargins, this.pageMargins[i] || {});
        // never less than its minimum, whatever was set, stored or passed to the constructor (top allows a bit less)
        m.top = Math.max(jCaret.MIN_MARGIN_TOP, parseFloat(m.top) || 0);
        ['bottom', 'left', 'right'].forEach(side => { m[side] = Math.max(jCaret.MIN_MARGIN, parseFloat(m[side]) || 0); });
        return m;
    }

    /** Keeps margins sane (0-100 mm) and always leaves a usable text area on the page. */
    _clampMargins(m, changedSide) {
        const C = jCaret;
        const num = (v, min) => {
            v = parseFloat(v);
            return isFinite(v) ? Math.min(100, Math.max(min, Math.round(v * 10) / 10)) : min;
        };
        const c = { top: num(m.top, C.MIN_MARGIN_TOP), bottom: num(m.bottom, C.MIN_MARGIN), left: num(m.left, C.MIN_MARGIN), right: num(m.right, C.MIN_MARGIN) };
        const maxV = C.PAGE_H - C.MIN_CONTENT, maxH = C.PAGE_W - C.MIN_CONTENT;
        if (c.top + c.bottom > maxV) {
            if (changedSide === 'bottom') c.bottom = Math.max(C.MIN_MARGIN, maxV - c.top);
            else c.top = Math.max(C.MIN_MARGIN_TOP, maxV - c.bottom);
        }
        if (c.left + c.right > maxH) {
            if (changedSide === 'right') c.right = Math.max(C.MIN_MARGIN, maxH - c.left);
            else c.left = Math.max(C.MIN_MARGIN, maxH - c.right);
        }
        return c;
    }

    /** Public API: setPageNumberInset(25) - distance (mm) of the page number from the right edge of the sheet. */
    setPageNumberInset(mm) {
        const v = parseFloat(mm);
        this.pageNumberInset = Number.isFinite(v) ? Math.max(0, v) : 15;
        if (this.schedulePageGuides) this.schedulePageGuides();
    }

    /** Sets ONE margin ('top' | 'bottom' | 'left' | 'right') of ONE page (0-based). */
    setPageMargin(k, side, value) {
        if (k === null || k === undefined) return;
        const cur = this.getPageMargins(k);
        cur[side] = value;
        this.pageMargins[k] = this._clampMargins(cur, side);
        this.savePageMargins();
        if (this.schedulePageGuides) this.schedulePageGuides();
    }

    /** Public API: setPageMargins(0, {top: 25, bottom: 25, left: 20, right: 20}) - values in mm. */
    setPageMargins(k, margins) {
        this.pageMargins[k] = this._clampMargins(Object.assign(this.getPageMargins(k), margins), null);
        this.savePageMargins();
        this.fillMarginInputs();
        if (this.schedulePageGuides) this.schedulePageGuides();
    }

    savePageMargins() {
        if (!this.useLocalStorage) return;
        try {
            localStorage.setItem('jCaretMargins', JSON.stringify({ def: this.defaultMargins, pages: this.pageMargins }));
        } catch (_) { /* quota - ignore */ }
    }

    /** Builds the floating margin controller (one panel, re-used for every page). */
    createMarginPanel() {
        const t = this.i18n;
        const p = document.createElement('div');
        p.className = 'jcaret-margin-panel';
        p.hidden = true;
        p.dir = this.dir;
        p.innerHTML = `
            <div class="jcm-head">
                <strong class="jcm-title"></strong>
                <button type="button" class="jcm-x" data-act="close" title="${t.close}">&times;</button>
            </div>
            <div class="jcm-grid">
                <label><span>${t.marginTop}</span><input type="number" dir="ltr" min="${jCaret.MIN_MARGIN_TOP}" max="100" step="0.5" data-side="top"></label>
                <label><span>${t.marginBottom}</span><input type="number" dir="ltr" min="${jCaret.MIN_MARGIN}" max="100" step="0.5" data-side="bottom"></label>
                <label><span>${t.marginLeft}</span><input type="number" dir="ltr" min="${jCaret.MIN_MARGIN}" max="100" step="0.5" data-side="left"></label>
                <label><span>${t.marginRight}</span><input type="number" dir="ltr" min="${jCaret.MIN_MARGIN}" max="100" step="0.5" data-side="right"></label>
            </div>
            <div class="jcm-actions">
                <button type="button" data-act="all">${t.applyAllPages}</button>
                <button type="button" data-act="reset">${t.resetMargins}</button>
            </div>
            <div class="jcm-actions">
                <button type="button" data-act="downloadPng">${t.downloadPagePng}</button>
            </div>`;
        document.body.appendChild(p);
        this.marginPanel = p;
        this.marginPanelTitle = p.querySelector('.jcm-title');
        this.marginInputs = {};
        p.querySelectorAll('input[data-side]').forEach(i => { this.marginInputs[i.dataset.side] = i; });

        p.addEventListener('input', e => {
            const inp = e.target.closest('input[data-side]');
            if (!inp) return;
            const v = parseFloat(inp.value);
            if (!isFinite(v)) return;
            this.setPageMargin(this._marginPage, inp.dataset.side, v); // live preview
        });
        p.addEventListener('change', () => this.fillMarginInputs()); // show the sanitized numbers
        p.addEventListener('click', e => {
            const b = e.target.closest('button[data-act]');
            if (!b) return;
            const act = b.dataset.act;
            if (act === 'close') {
                this.closeMarginPanel();
            } else if (act === 'all') {
                // this page's margins become the default for EVERY page
                this.defaultMargins = this.getPageMargins(this._marginPage);
                this.pageMargins = {};
                this.savePageMargins();
                this.fillMarginInputs();
                this.schedulePageGuides();
            } else if (act === 'reset') {
                delete this.pageMargins[this._marginPage];
                this.savePageMargins();
                this.fillMarginInputs();
                this.schedulePageGuides();
            } else if (act === 'downloadPng') {
                this.downloadPageAsPNG(this._marginPage);
            }
        });
        p.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeMarginPanel(); });
    }

    fillMarginInputs() {
        if (!this.marginPanel || this._marginPage === null) return;
        const m = this.getPageMargins(this._marginPage);
        Object.keys(this.marginInputs).forEach(side => { this.marginInputs[side].value = m[side]; });
    }

    openMarginPanel(k) {
        if (!this.marginPanel) return;
        k = Math.max(0, Math.min((this._totalPages || 1) - 1, k || 0));
        this._marginPage = k;
        this.marginPanelTitle.textContent = `${this.i18n.pageMargins} - ${this.i18n.page} ${k + 1}`;
        this.fillMarginInputs();
        this.marginPanel.hidden = false;
        this.schedulePageGuides();
    }

    closeMarginPanel() {
        if (!this.marginPanel) return;
        this.marginPanel.hidden = true;
        this._marginPage = null;
        this.schedulePageGuides();
        this.editor.focus();
    }

    /**
     * @method initPageGuides
     * @description Creates the overlay that draws every page (margins, page numbers, per-page margin button)
     * and the "Page x / y" badge. The overlay ignores the mouse, so margins can never be edited.
     */
    initPageGuides() {
        this.container.style.maxWidth = `max(${this.width}, calc(210mm + 24px))`;
        this.editorWrapper.style.position = 'relative';

        this.pageGuides = document.createElement('div');
        this.pageGuides.className = 'jcaret-page-guides';
        this.pageGuides.setAttribute('contenteditable', 'false');
        this.pageGuidesInner = document.createElement('div');
        this.pageGuidesInner.className = 'jcaret-page-guides-inner';
        this.pageGuides.appendChild(this.pageGuidesInner);
        this.editorWrapper.appendChild(this.pageGuides);

        this.pageBadge = document.createElement('div');
        this.pageBadge.className = 'jcaret-page-badge';
        this.editorWrapper.appendChild(this.pageBadge);

        this.createMarginPanel();
        // the little margin button drawn on every page
        this.pageGuides.addEventListener('click', e => {
            const b = e.target.closest('.jcaret-page-btn');
            if (b) this.openMarginPanel(parseInt(b.dataset.page, 10));
        });

        this._pgKey = '';
        this._pgRaf = null;
        this._totalPages = 1;
        const schedule = () => {
            if (this._pgRaf) return;
            this._pgRaf = requestAnimationFrame(() => {
                this._pgRaf = null;
                if (this._composing) return;   // never touch the text while an IME is composing (redone on compositionend)
                this.updatePageGuides();
            });
        };
        this.schedulePageGuides = schedule;

        this._pgObserverOpts = { childList: true, subtree: true, characterData: true, attributes: true };
        this._pgObserver = new MutationObserver(schedule);
        this._pgObserver.observe(this.editor, this._pgObserverOpts);
        if (window.ResizeObserver) new ResizeObserver(schedule).observe(this.editor);
        window.addEventListener('resize', schedule);
        this.editor.addEventListener('compositionstart', () => { this._composing = true; });
        this.editor.addEventListener('compositionend', () => { this._composing = false; schedule(); });
        this.editor.addEventListener('load', schedule, true);
        document.addEventListener('selectionchange', () => this.updatePageBadge());
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
        schedule();
    }

    /**
     * @method fitEditorToPageWidth
     * @description Makes the editor exactly one A4 sheet wide. The editor itself has NO side padding:
     * side margins are applied per block (so every page can have its own), the top margin of page 1 is
     * the editor's padding-top, and every other page's top margin is produced by paginate().
     */
    fitEditorToPageWidth() {
        const MM = jCaret.MM, ed = this.editor;
        const cs = getComputedStyle(ed);
        const bw = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
        const w = `min(100%, calc(210mm + ${bw}px))`;
        if (ed.style.width !== w) {
            ed.style.boxSizing = 'border-box';
            ed.style.width = w;
            ed.style.margin = '0 auto';
            ed.style.background = '#fff';
            ed.style.boxShadow = '0 1px 6px rgba(0,0,0,.25)';
        }
        ed.style.height = 'auto';
        ed.style.maxHeight = 'none';
        ed.style.overflow = 'visible';
        this.editorWrapper.style.padding = '16px 0';
        this.editorWrapper.style.background = '#e5e7eb';

        const pt = (this.getPageMargins(0).top * MM).toFixed(2) + 'px';
        ed.style.paddingLeft = '0px';
        ed.style.paddingRight = '0px';
        ed.style.paddingBottom = '0px';
        if (ed.style.paddingTop !== pt) ed.style.paddingTop = pt;
    }

    /** Top-level blocks; list items count as separate blocks so long lists can split. */
    getPageUnits(root) {
        const units = [];
        for (const el of root.children) {
            // A floating (handwriting) figure is position:absolute - it never takes part in the normal flow that
            // pagination lays out, and measuring it here would corrupt pagination (its rect reflects a manually
            // dragged position, not where flow content sits, and a margin-top spacer has no effect on it at all).
            if (el.classList && el.classList.contains('floating')) continue;
            if (/^(UL|OL)$/.test(el.tagName)) {
                units.push(...Array.from(el.children).filter(c => c.tagName === 'LI'));
            } else {
                units.push(el);
            }
        }
        return units;
    }

    /** Removes the temporary page spacers (top-of-page margins). */
    clearPageSpacers(root) {
        // spacers that break a paragraph between two lines (see _splitUnit)
        root.querySelectorAll('span[data-jc-brk]').forEach(sp => {
            const par = sp.parentNode;
            if (!par) return;
            par.removeChild(sp);
            par.normalize();
        });
        root.querySelectorAll('[data-jc-pb]').forEach(el => {
            el.removeAttribute('data-jc-pb');
            el.style.removeProperty('--jc-pb');
            if (!el.getAttribute('style')) el.removeAttribute('style');
        });
    }

    /** Removes EVERY temporary layout mark (spacers + side margins). */
    clearLayoutMarks(root) {
        root.querySelectorAll('.jcaret-handwrite-overlay').forEach(el => el.remove());   // a still-open drawing session's scratch layer, never real content
        root.querySelectorAll('span[data-jc-brk]').forEach(sp => sp.remove());
        root.querySelectorAll('[data-jc-pb], [data-jc-side]').forEach(el => {
            el.removeAttribute('data-jc-pb');
            el.removeAttribute('data-jc-side');
            ['--jc-pb', '--jc-ml', '--jc-mr', '--jc-mm', '--jc-fml', '--jc-fmr', '--jc-cell-mw'].forEach(p => el.style.removeProperty(p));
            if (!el.getAttribute('style')) el.removeAttribute('style');
        });
        // A table that had to be narrowed to fit inside the page margins (see _fitTableInFigure) is bookkeeping, not
        // real content: restore whatever the table's width was before that (a plain table, or a manually resized
        // one) so a saved / printed / re-measured copy starts clean and the next layout pass measures it fresh.
        root.querySelectorAll('table[data-jc-natural-w]').forEach(table => {
            if (table.dataset.jcShrunk === '1') {
                table.style.width = table.dataset.jcPrevWidth || '';
                table.style.tableLayout = table.dataset.jcPrevLayout || '';
                if (!table.getAttribute('style')) table.removeAttribute('style');
            }
            delete table.dataset.jcNaturalW;
            delete table.dataset.jcShrunk;
            delete table.dataset.jcPrevWidth;
            delete table.dataset.jcPrevLayout;
        });
    }

    /** Saved/exported HTML: no page spacers, no resize handles, no selection classes. */
    getCleanHTML() {
        const c = this.editor.cloneNode(true);
        this.clearLayoutMarks(c);
        c.querySelectorAll('.resize-handle, .rotate-handle, .rotate-handle-stem').forEach(h => h.remove());
        c.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        return c.innerHTML;
    }

    /** Content used for undo/redo comparisons (always clean, so layout work never counts as an edit). */
    snapshot() {
        return this.getCleanHTML();
    }

    /**
     * Gives a top-level block the side margins of the page it sits on.
     * Figures (images / tables) keep their own alignment logic, so they are only clamped inside the margins
     * and nudged with `left`, based on where they really are (left / centre / right).
     */
    _applySide(top, k, scale, root) {
        const MM = jCaret.MM, m = this.getPageMargins(k);
        const ml = m.left * MM * scale, mr = m.right * MM * scale;
        const set = (p, v) => { if (top.style.getPropertyValue(p) !== v) top.style.setProperty(p, v); };
        if (!top.hasAttribute('data-jc-side')) top.setAttribute('data-jc-side', '1');
        set('--jc-ml', ml.toFixed(2) + 'px');
        set('--jc-mr', mr.toFixed(2) + 'px');
        if (top.tagName === 'FIGURE') {
            set('--jc-mm', Math.max(ml, mr).toFixed(2) + 'px');
            // Real margins position the figure (it now shrinks to its own content instead of stretching full width,
            // see the CSS), so "center" / "left" / "right" actually center it or hug an edge:
            //  - center: equal margins on both sides -> the browser centers it on the full page width
            //  - left / right ("hug the left / right margin line"): one real margin, the other margin auto
            //  - full: fills exactly the box between the two margins (its width is set to 100% elsewhere)
            let fml = ml.toFixed(2) + 'px', fmr = mr.toFixed(2) + 'px';
            if (top.classList.contains('right')) fml = 'auto';
            else if (top.classList.contains('left')) fmr = 'auto';
            else if (!top.classList.contains('full')) { fml = 'auto'; fmr = 'auto'; }   // center (or no class yet)
            set('--jc-fml', fml);
            set('--jc-fmr', fmr);
            this._fitTableInFigure(top, root);
        }
    }

    /**
     * @method _fitTableInFigure
     * @description A table only ever grows as wide as the columns need (min-width per cell); with many columns that
     * can be wider than the page's margins allow. This shrinks the table - and only the table, not images - down to
     * the width the current page's margins leave available, by lowering every cell's minimum width together (a
     * single custom property the cells inherit). The table's true, unshrunk width is measured once and kept on the
     * table (data-jc-natural-w), since after shrinking, measuring again would just measure the shrunk table.
     */
    _fitTableInFigure(fig, root) {
        const table = fig.querySelector('table');
        if (!table) return;
        if (table.dataset.jcNaturalW === undefined) {
            // measure the table's true, un-shrunk width once (undoing any shrink of ours while measuring, so a table
            // that was already shrunk on a previous, narrower page is not mistaken for one that is naturally narrow)
            const shrunk = table.dataset.jcShrunk === '1', savedCellMw = fig.style.getPropertyValue('--jc-cell-mw');
            if (shrunk) {
                fig.style.removeProperty('--jc-cell-mw');
                table.style.tableLayout = table.dataset.jcPrevLayout || '';
                table.style.width = table.dataset.jcPrevWidth || '';
            }
            table.dataset.jcNaturalW = table.getBoundingClientRect().width.toFixed(1);
            if (shrunk) {
                if (savedCellMw) fig.style.setProperty('--jc-cell-mw', savedCellMw);
                table.style.tableLayout = 'fixed';
                table.style.width = table.style.width;   // (still the shrunk width from before; re-set below anyway)
            }
        }
        const natural = parseFloat(table.dataset.jcNaturalW) || 0;
        const cs = getComputedStyle(fig);
        const ml = parseFloat(cs.getPropertyValue('--jc-ml')) || 0, mr = parseFloat(cs.getPropertyValue('--jc-mr')) || 0;
        const side = fig.classList.contains('center') ? 2 * Math.max(ml, mr) : ml + mr;
        const avail = Math.max(50, root.clientWidth - side);
        if (natural > avail + 0.5) {
            // Too wide for this page's margins: shrink every cell together (a table.style.width set by a manual drag-
            // resize is remembered first, so un-shrinking later restores exactly that instead of the table's default).
            if (table.dataset.jcShrunk !== '1') {
                table.dataset.jcPrevWidth = table.style.width || '';
                table.dataset.jcPrevLayout = table.style.tableLayout || '';
                table.dataset.jcShrunk = '1';
            }
            fig.style.setProperty('--jc-cell-mw', '0px');
            table.style.tableLayout = 'fixed';
            table.style.width = avail.toFixed(1) + 'px';
        } else if (table.dataset.jcShrunk === '1') {
            // fits again (e.g. the margins were made smaller): undo, but only our own shrink
            fig.style.removeProperty('--jc-cell-mw');
            table.style.tableLayout = table.dataset.jcPrevLayout || '';
            table.style.width = table.dataset.jcPrevWidth || '';
            delete table.dataset.jcShrunk;
            delete table.dataset.jcPrevWidth;
            delete table.dataset.jcPrevLayout;
        }
        // else: already fits and was never shrunk - leave the table's own width (default, or a manual resize) alone
    }

    /**
     * @method _splitUnit
     * @description Breaks a text paragraph (P / LI) between two lines so that the first part ends at the bottom margin
     * of the page and the rest continues at the top of the next page. The break is a temporary block-level
     * <span data-jc-brk> whose height pushes the following lines to the next page; it is removed on every layout
     * pass and never saved. Widows and orphans: at least two lines stay on each side.
     * @param {Element} u          the paragraph / list item
     * @param {number} zbAbs       bottom of the text area of the current page (viewport px)
     * @param {number} nextTopAbs  top of the text area of the next page (viewport px)
     * @param {number} fragTopAbs  top of the part of the paragraph that is on the current page (viewport px)
     * @param {number} contPage    index of the next page (kept on the span; used when printing)
     * @returns {boolean} true when a break was inserted
     */
    _splitUnit(u, zbAbs, nextTopAbs, fragTopAbs, contPage) {
        if (!/^(P|LI|PRE)$/.test(u.tagName) || u.querySelector(jCaret.NO_SPLIT)) return false;
        const doc = u.ownerDocument;
        const range = doc.createRange();
        let list = [], total = 0;
        const collect = () => {
            list = []; total = 0;
            const tw = doc.createTreeWalker(u, 4 /* SHOW_TEXT */);
            let n;
            while ((n = tw.nextNode())) {
                const len = n.nodeValue.length;
                if (len) { list.push({ n, s: total }); total += len; }
            }
        };
        collect();
        if (total < 30) return false;
        const locate = i => {
            let lo = 0, hi = list.length - 1;
            while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (list[mid].s <= i) lo = mid; else hi = mid - 1; }
            return { n: list[lo].n, o: i - list[lo].s };
        };
        const rectExact = i => {                         // box of character i (null when it is not drawn, e.g. collapsed space)
            const p = locate(i);
            range.setStart(p.n, p.o);
            range.setEnd(p.n, p.o + 1);
            const rs = range.getClientRects();
            for (let j = 0; j < rs.length; j++) {
                if (rs[j].height > 1) return { top: rs[j].top, bottom: rs[j].bottom, i };
            }
            return null;
        };
        const rectAt = i => { for (let d = 0; d < 24 && i + d < total; d++) { const r = rectExact(i + d); if (r) return r; } return null; };
        const rectBefore = i => { for (let d = 1; d <= 24 && i - d >= 0; d++) { const r = rectExact(i - d); if (r) return r; } return null; };
        const sameLine = (a, c) => Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 0.5 * Math.min(a.bottom - a.top, c.bottom - c.top);
        const lineStart = (i, ref) => {
            let s = i;
            for (let g = 0; g < 600 && s > 0; g++) {
                const pr = rectBefore(s);
                if (!pr || !sameLine(pr, ref)) break;
                s = pr.i;
            }
            return s;
        };

        const first = rectAt(0);
        let lastI = total - 1, last = null;
        while (lastI >= 0 && !(last = rectExact(lastI))) lastI--;
        if (!first || !last) return false;
        const h0 = first.bottom - first.top;
        if (last.bottom <= zbAbs + 0.5) return false;              // it does fit
        if (last.bottom - fragTopAbs < 3.6 * h0) return false;     // fewer than four lines: keep it together

        // first character that is drawn below the text area, then the start of ITS line
        let lo = 0, hi = total - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const r = rectAt(mid);
            if (r && r.bottom > zbAbs) hi = mid; else lo = mid + 1;
        }
        let ref = rectAt(lo);
        if (!ref) return false;
        let s = lineStart(lo, ref);

        // widows: at least two lines must move to the next page
        let sr = rectAt(s);
        if (sr && last.top - sr.top < 0.8 * h0) {
            const pr = rectBefore(s);
            if (!pr) return false;
            s = lineStart(pr.i, pr);
        }

        let span = null;
        for (let attempt = 0; attempt < 10; attempt++) {
            sr = rectAt(s);
            if (!sr || s <= 0) return false;
            if (sr.top - fragTopAbs < 1.7 * h0) return false;      // orphans: at least two lines stay on this page
            const p = locate(s);
            span = doc.createElement('span');
            span.setAttribute('data-jc-brk', String(contPage));
            span.setAttribute('contenteditable', 'false');
            span.style.cssText = 'display:block;height:0;margin:0;padding:0;border:0;line-height:0;font-size:0;overflow:hidden;';
            range.setStart(p.n, p.o);
            range.collapse(true);
            range.insertNode(span);
            if (span.getBoundingClientRect().top <= zbAbs + 0.5) break;   // the kept lines really fit
            // too tall (mixed line heights): give one more line to the next page
            const par = span.parentNode;
            par.removeChild(span);
            par.normalize();
            span = null;
            collect();
            const pr = rectBefore(s);
            if (!pr) return false;
            s = lineStart(pr.i, pr);
        }
        if (!span) return false;
        const st = span.getBoundingClientRect().top;
        span.style.height = Math.max(0, nextTopAbs - st).toFixed(2) + 'px';
        return true;
    }

    /**
     * @method paginate
     * @description Lays the blocks out on A4 pages. Page k occupies [k*297mm, (k+1)*297mm) of the editor and its
     * text area is limited by ITS OWN margins. A block that does not fit on the rest of the page (or that carries
     * data-jc-break) is pushed to the top of the next page with a temporary spacer, so text can never land in a
     * margin. Works on the live editor and on the print copy.
     * @param {number} gap empty space between two sheets in px (screen: PAGE_GAP, print: 0)
     * @param {number} slack px kept free above the bottom margin (print uses a little, against rounding)
     * @returns {{total:number}} number of pages
     */
    paginate(root, scale = 1, gap = jCaret.PAGE_GAP, slack = 0) {
        const MM = jCaret.MM, P = jCaret.PAGE_H * MM, S = P + gap;   // S = distance from one sheet to the next
        const win = root.ownerDocument.defaultView;
        this.clearPageSpacers(root);

        const mt = i => this.getPageMargins(i).top * MM;
        const mb = i => this.getPageMargins(i).bottom * MM;
        const zTop = i => i * S + mt(i);
        const zBot = i => i * S + P - mb(i) - slack;
        const zH = i => zBot(i) - zTop(i);

        // Editor top, read again next to EVERY block measurement (the page may scroll while blocks move)
        const baseOf = () => root.getBoundingClientRect().top + root.clientTop;
        const units = this.getPageUnits(root);
        let k = 0;            // page the next block will be placed on
        let endPage = 0;      // page the previous block really ended on
        let lastBottom = 0;
        let seen = false;

        for (const u of units) {
            const top = u.tagName === 'LI' ? u.parentElement : u;
            const isHead = u === top || top.firstElementChild === u;
            if (!u.getBoundingClientRect().height) continue;

            // Manual page (Add page button): must start on a fresh page
            if (seen && u.hasAttribute('data-jc-break') && k < endPage + 1) k = endPage + 1;

            let t = 0, b = 0, guard = 0;
            for (;;) {
                if (isHead) this._applySide(top, k, scale, root);
                const base = baseOf();
                const r = u.getBoundingClientRect();
                t = r.top - base;
                b = r.bottom - base;
                const h = r.height;
                const zt = zTop(k), zb = zBot(k);
                let dest = -1;
                if (t < zt - 0.5) {
                    dest = k;                                                                  // above this page's text area
                } else if (b > zb + 0.5) {
                    // Does not fit on this page. A paragraph is broken between two lines (as in a word processor),
                    // so the page is filled down to its bottom margin; anything else moves to the next page.
                    let sk = k, fragTop = base + t, n = 0, bb = b;
                    while (bb > zBot(sk) + 0.5 && n++ < 400 &&
                           this._splitUnit(u, base + zBot(sk), base + zTop(sk + 1), fragTop, sk + 1)) {
                        sk++;
                        fragTop = base + zTop(sk);
                        bb = u.getBoundingClientRect().bottom - baseOf();
                    }
                    if (sk > k) { k = sk; t = 0; b = bb; guard = -1; break; }
                    if (t > zt + 0.5 && h <= zH(k + 1) + 0.5) dest = k + 1;                    // does not fit -> next page
                }
                if (dest < 0 || guard++ >= 8) break;
                k = dest;
                if (isHead) this._applySide(top, k, scale, root);
                const delta = zTop(k) - t;
                if (Math.abs(delta) > 0.25) {
                    const cur = parseFloat(win.getComputedStyle(u).marginTop) || 0;
                    u.setAttribute('data-jc-pb', String(k));   // value = the page this block starts
                    u.style.setProperty('--jc-pb', Math.max(0, cur + delta).toFixed(2) + 'px');
                }
            }

            // a block taller than the text area keeps going onto the following pages
            let g2 = 0;
            while (b > zBot(k) + 0.5 && g2++ < 500) k++;
            endPage = Math.max(0, Math.floor((b - 0.5) / S));
            lastBottom = Math.max(lastBottom, b);
            seen = true;
        }
        const total = Math.max(1, Math.floor((lastBottom - 0.5) / S) + 1, k > endPage ? endPage + 1 : 1);
        return { total };
    }

    /**
     * @method updatePageGuides
     * @description Re-paginates and redraws the overlay (margin bands, page numbers, margin buttons, page badge).
     */
    updatePageGuides() {
        if (!this.pageGuides) return;
        const MM = jCaret.MM, ed = this.editor, P = jCaret.PAGE_H * MM, G = jCaret.PAGE_GAP, S = P + G;
        this._pgObserver.disconnect();
        try {
            this.fitEditorToPageWidth();
            const scale = Math.min(1, ed.clientWidth / (jCaret.PAGE_W * MM)) || 1;
            const { total } = this.paginate(ed, scale);
            this._totalPages = total;

            const minH = `calc(${total * jCaret.PAGE_H}mm + ${(total - 1) * G + 2 * ed.clientTop}px)`;
            if (ed.style.minHeight !== minH) ed.style.minHeight = minH;

            Object.assign(this.pageGuides.style, {
                top: (ed.offsetTop + ed.clientTop) + 'px',
                left: (ed.offsetLeft + ed.clientLeft) + 'px',
                width: ed.clientWidth + 'px',
                // 20px more than the editor: the number of the last page may sit just below its sheet
                height: (ed.offsetHeight - 2 * ed.clientTop + 20) + 'px'
            });
            this.pageGuidesInner.style.height = (ed.offsetHeight + 20) + 'px';

            const tint = 'position:absolute;background:rgba(59,130,246,.07);';
            let html = '';
            for (let i = 0; i < total; i++) {
                const m = this.getPageMargins(i);
                const top = m.top * MM, bot = m.bottom * MM;
                const left = m.left * MM * scale, right = m.right * MM * scale;
                const numRight = this.pageNumberInset * MM * scale;   // page number: fixed distance from the sheet's right edge (ignores the right margin)
                const y = i * S, bodyH = P - top - bot;
                const active = this._marginPage === i;
                // Page number: a fixed distance from the page's bottom edge - it stays close to the edge even
                // with a big margin, instead of drifting up as the margin grows.
                const numTop = y + P - jCaret.PAGE_NUM_OFFSET * MM;
                // the text-area box always keeps its plain dashed outline; only the OUTER sheet border (below)
                // highlights blue when this page's margin panel is open, so there is one clear highlight, not two.
                const edge = 'border:1px dashed rgba(59,130,246,.4)';
                if (i < total - 1) {
                    html += `<div style="position:absolute;left:0;right:0;top:${y + P}px;height:${G}px;background:#e5e7eb;box-shadow:inset 0 3px 3px -2px rgba(0,0,0,.3),inset 0 -3px 3px -2px rgba(0,0,0,.3)"></div>`;
                }
                // When this page's margin panel is open, also outline the whole SHEET (not just the text area
                // between the margins), so the page being edited - and the caret inside it - is easy to spot.
                const outer = active ? `<div style="position:absolute;left:0;right:0;top:${y}px;height:${P}px;border:2px solid rgba(37,99,235,.85);box-sizing:border-box;pointer-events:none"></div>` : '';
                                const watermark = this.watermark.text ? `<div style="position:absolute;left:0;right:0;top:${y}px;height:${P}px;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;user-select:none;"><span style="transform:rotate(${this.watermark.angle}deg);white-space:nowrap;font:700 ${this.watermark.fontSize * scale}px Arial, sans-serif;color:${this.watermark.color};opacity:${this.watermark.opacity};">${this._escapeHtml(this.watermark.text)}</span></div>` : '';
                html += outer + watermark +
                    `<div style="${tint}left:0;right:0;top:${y}px;height:${top}px"></div>` +
                    `<div style="${tint}left:0;right:0;top:${y + P - bot}px;height:${bot}px"></div>` +
                    `<div style="${tint}left:0;width:${left}px;top:${y + top}px;height:${bodyH}px"></div>` +
                    `<div style="${tint}right:0;width:${right}px;top:${y + top}px;height:${bodyH}px"></div>` +
                    `<div style="position:absolute;left:${left}px;right:${right}px;top:${y + top}px;height:${bodyH}px;${edge};box-sizing:border-box"></div>` +
                    `<div class="jcaret-page-num" style="right:${numRight}px;top:${numTop}px">${i + 1} / ${total}</div>` +
                    `<button type="button" class="jcaret-page-btn" data-page="${i}" title="${this.i18n.pageMargins} ${i + 1}" style="top:${y + 6}px"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><rect x="3.75" y="2.75" width="16.5" height="18.5" rx="1.5"/><rect x="7.5" y="6.5" width="9" height="11" stroke-dasharray="2 2"/></svg></button>`;
            }
            if (html !== this._pgKey) {
                this._pgKey = html;
                this.pageGuidesInner.innerHTML = html;
            }
            if (this._marginPage !== null && this._marginPage > total - 1) this.closeMarginPanel();

            this.updatePageBadge();
        } finally {
            this._pgObserver.observe(ed, this._pgObserverOpts);
        }
    }

    /** "Page x / y" badge that follows the caret. */
    updatePageBadge() {
        if (!this.pageBadge) return;
        const ed = this.editor, sel = window.getSelection();
        if (!sel.rangeCount || !ed.contains(sel.anchorNode)) { this.pageBadge.style.display = 'none'; return; }
        let rect = sel.getRangeAt(0).getBoundingClientRect();
        if (!rect || (rect.top === 0 && rect.height === 0)) {
            let n = sel.anchorNode;
            if (n.nodeType !== 1) n = n.parentElement;
            rect = n.getBoundingClientRect();
        }
        const P = jCaret.PAGE_H * jCaret.MM + jCaret.PAGE_GAP;
        const c = rect.top + 1 - (ed.getBoundingClientRect().top + ed.clientTop);
        const total = this._totalPages || 1;
        const cur = Math.min(total, Math.max(1, Math.floor(c / P) + 1));
        this._currentPage = cur - 1;
        this.pageBadge.style.display = '';
        this.pageBadge.textContent = `A4 · ${this.i18n.page} ${cur} / ${total}`;
    }

    /**
     * @method addPage
     * @description Appends a new blank page at the end of the document and moves the caret to it.
     * (A page break is stored as an empty paragraph carrying data-jc-break.)
     */
    addPage() {
        const oldContent = this.snapshot();
        const p = document.createElement('p');
        p.setAttribute('data-jc-break', '1');
        p.innerHTML = '<br>';
        this.editor.appendChild(p);
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(p, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        this.editor.focus();
        this.pushUndoState(oldContent);
        if (this.pageGuides) this.updatePageGuides();
        this.scrollCaretIntoView();
    }

    /** Scrolls the block that holds the caret into view (window or editor, whichever scrolls). */
    scrollCaretIntoView() {
        const block = this.getThisCurrentBlockElement();
        let n = block;
        if (!n) {
            const sel = window.getSelection();
            n = sel.anchorNode;
            if (n && n.nodeType !== 1) n = n.parentElement;
        }
        if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
    }

    /**
     * @method onEditorMouseDown
     * @description Margins and the space between pages are not editable: a click that lands on them
     * (i.e. on the editor itself, not on a block) puts the caret in the nearest text instead.
     */
    onEditorMouseDown(e) {
        if (!this.pageGuides || e.button !== 0 || e.target !== this.editor) return;
        let best = null, bestD = Infinity;
        for (const b of Array.from(this.editor.children)) {
            const r = b.getBoundingClientRect();
            if (!r.height) continue;
            const d = e.clientY < r.top ? r.top - e.clientY : (e.clientY > r.bottom ? e.clientY - r.bottom : 0);
            if (d < bestD) { bestD = d; best = b; }
        }
        if (!best || best.tagName === 'FIGURE') return;   // figures have their own click handling
        e.preventDefault();
        this.editor.focus();
        const r = best.getBoundingClientRect();
        let range = null;
        if (bestD === 0 && document.caretRangeFromPoint) {
            const x = Math.min(Math.max(e.clientX, r.left + 1), r.right - 1);
            range = document.caretRangeFromPoint(x, e.clientY);
            if (range && !best.contains(range.startContainer)) range = null;
        }
        if (!range) {
            range = document.createRange();
            range.selectNodeContents(best);
            range.collapse(e.clientY < r.top);   // above -> start of the block, below -> end
        }
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        this.updateToolbarState();
    }

    // =====================================================================
    //  SELECTION / UNDO HELPERS
    // =====================================================================

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
        const now = this.snapshot();
        if (now !== this.lastContent) {
            this.undoStack.push(this.lastContent);
            this.undoStack = this.undoStack.slice(-50);
            this.redoStack = [];
            this.lastContent = now;
            this.saveAll();
        }
    }, 1000);

    /**
     * @method pushUndoState
     * @description Helper to push the current state to the undo stack.
     * @param {string} oldContent The (clean) content *before* the change - use this.snapshot().
     */
    pushUndoState(oldContent) {
        const now = this.snapshot();
        if (now !== oldContent) {
            this.undoStack.push(oldContent);
            this.undoStack = this.undoStack.slice(-50); // keep the stack small
            this.redoStack = [];
            this.lastContent = now;
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
        this.fontColorInput.value = "#000000";
        this.foreColorBar.style.backgroundColor = "#000000";
        document.execCommand('backColor', false, '#ffffff');
        this.highlightBar.style.backgroundColor = '#ffffff';
        const defaultFont = this.language === 'ar' ? 'Amiri' : 'Inter';
        document.execCommand('fontName', false, defaultFont);
        document.execCommand('fontSize', false, '3');
        document.execCommand('removeFormat', false, null);
        const sel = window.getSelection();
        sel.removeAllRanges();
    }
    /**
     * @method performClearAll
     * @description Actually clears the document (called once the person confirms in the modal): wipes the
     * content back to one empty paragraph AND removes the watermark, since starting a document over should not
     * leave a watermark from before behind. Records its own single undo step, since the confirmation now happens
     * later, in the modal, rather than inline in the toolbar's click handler.
     */
    performClearAll() {
        const oldContent = this.snapshot();
        this.redoStack = [];
        this.editor.innerHTML = '<p><br></p>';
        this.selectedResizable = null;
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(this.editor.firstChild, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        this.resetEditorStyles();
        if (this.watermark.text) {
            this.watermark.text = '';
            this.saveWatermark();
            if (this.watermarkMenu) this.watermarkMenu.querySelector('#wmText').value = '';
        }
        if (this.schedulePageGuides) this.schedulePageGuides();
        this.pushUndoState(oldContent);
    }
    /**
     * @method applyInlineStyle
     * @description Applies an inline style to the selected text or insertion point.
     * @param {string} property The CSS property to apply (e.g., 'font-size').
     * @param {string} value The value for the CSS property (e.g., '48px').
     */
    applyInlineStyle(property, value) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) {
            const span = document.createElement('span');
            span.style[property] = value;
            span.style.lineHeight = 'normal';
            try {
                range.surroundContents(span);
            } catch (_) {
                // The selection crosses element boundaries (several sizes / lines): ask the user to select less
                this.selectModal.classList.remove('hidden');
                return;
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
    /** Puts the caret at the end of a node. */
    setCaretToEnd(node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
    /**
     * @method removeCurrentBlankLine
     * @description Removes the empty block that holds the caret (keeps the very first line).
     */
    removeCurrentBlankLine() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        let currentNode = selection.anchorNode;
        if (currentNode.nodeType === 3) currentNode = currentNode.parentNode;
        const block = currentNode.closest('p, div, li');
        if (!block || !this.editor.contains(block) || block === this.editor) return;
        const hasText = block.textContent.trim().length > 0;
        const hasImages = block.querySelector('img') !== null;
        if (hasText || hasImages) return;
        const prevBlock = block.previousElementSibling;
        if (prevBlock) {
            block.remove();
            this.setCaretToEnd(prevBlock);
        } else {
            block.innerHTML = '<br>';
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
     * @method isFirstCharNotRTL
     * @description Checks if the first character of a text is NOT a right-to-left character.
     */
    isFirstCharNotRTL(text) {
        if (!text || typeof text !== 'string') return true;
        const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u07C0-\u07FF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
        return !rtlRegex.test(text.charAt(0));
    }
    /** Nearest block element (P, DIV, LI, H1-6, PRE, BLOCKQUOTE) around the caret. */
    getThisCurrentBlockElement() {
        let node = window.getSelection().anchorNode;
        while (node && node.nodeType !== Node.ELEMENT_NODE) {
            node = node.parentNode;
        }
        const blockTags = /^(P|DIV|LI|H[1-6]|PRE|BLOCKQUOTE)$/i;
        while (node && node !== this.editor && !blockTags.test(node.tagName)) {
            node = node.parentNode;
        }
        return node && node !== this.editor && blockTags.test(node.tagName) ? node : null;
    }

    // =====================================================================
    //  KEYBOARD
    // =====================================================================

    /** Shift+Tab: removes up to 4 spaces that sit right before the caret. */
    outdentAtCaret() {
        const sel = window.getSelection();
        if (!sel.rangeCount || !sel.isCollapsed) return;
        const r = sel.getRangeAt(0);
        let node = r.startContainer, off = r.startOffset;
        if (node.nodeType !== 3) {
            const prev = node.childNodes[off - 1];
            if (!prev || prev.nodeType !== 3) return;
            node = prev;
            off = prev.nodeValue.length;
        }
        const txt = node.nodeValue;
        let n = 0;
        while (n < 4 && off - n - 1 >= 0 && /[ \u00a0]/.test(txt[off - n - 1])) n++;
        if (!n) return;
        const oldContent = this.snapshot();
        node.deleteData(off - n, n);
        this.pushUndoState(oldContent);
    }

    /**
     * After Enter the browser copies the attributes of the split block. A page break must belong to ONE block only,
     * otherwise pressing Enter on a manual page would create yet another page.
     */
    _dedupePageBreak() {
        let n = window.getSelection().anchorNode;
        if (!n) return;
        if (n.nodeType !== 1) n = n.parentElement;
        while (n && n.parentElement !== this.editor) n = n.parentElement;
        if (!n || !n.hasAttribute('data-jc-break')) return;
        const prev = n.previousElementSibling;
        if (prev && prev.hasAttribute('data-jc-break')) n.removeAttribute('data-jc-break');
    }

    /**
     * On a new line, superscript / subscript are switched off (their toolbar buttons become "not clicked"),
     * so the next line starts as normal text.
     */
    _clearScriptFormatting() {
        ['superscript', 'subscript'].forEach(cmd => {
            let on = false;
            try { on = document.queryCommandState(cmd); } catch (_) {}
            if (on) {
                try { document.execCommand(cmd, false, null); } catch (_) {}
            }
        });
        // the empty <sup> / <sub> the browser carried into the new empty line is not needed any more
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        let n = sel.anchorNode;
        if (n && n.nodeType !== 1) n = n.parentElement;
        const holder = n && n.closest ? n.closest('sup, sub') : null;
        if (holder && this.editor.contains(holder) && holder.textContent === '') {
            const block = holder.closest('p, li, blockquote, div');
            if (block && this.editor.contains(block) && block !== this.editor && block.textContent === '' && !block.querySelector('img, table')) {
                const range = document.createRange();
                block.innerHTML = '<br>';
                range.setStart(block, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }

    /**
     * @method onKeyDown
     * @description Handles custom keyboard shortcuts and behaviors (Tab, Ctrl +/-, Enter, Delete).
     */
    onKeyDown(e) {
        // ---- Tab: insert 4 spaces (non-breaking, so they are never collapsed) ----
        if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            if (!window.getSelection().rangeCount) return;
            if (e.shiftKey) {
                this.outdentAtCaret();
                return;
            }
            const oldContent = this.snapshot();
            if (this._preAtCaret()) this._insertTextAtCaret('    ');    // code: real spaces
            else document.execCommand('insertText', false, '\u00a0\u00a0\u00a0\u00a0');
            this.pushUndoState(oldContent);
            return;
        }

        // ---- Inside a code block: Enter = new line of code (Enter on an empty last line leaves the block) ----
        const codePre = this._preAtCaret();
        if (codePre) {
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this._codeEnter(codePre);
                return;
            }
            if (e.key === ' ') return;   // (the highlight reset below must not touch code)
        }

        // ---- Font size increase (Ctrl +) ----
        if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            this.saveSelection();
            this.restoreSelection();
            const oldContent = this.snapshot();
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            let el = sel.getRangeAt(0).startContainer;
            if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
            if (!this.editor.contains(el)) el = this.editor;
            const currentPx = parseFloat(window.getComputedStyle(el, null).getPropertyValue('font-size'));
            this.applyInlineStyle('font-size', `${currentPx + 2}px`);
            this.mergeNestedSpans();
            this.pushUndoState(oldContent);
            return;
        }
        // ---- Font size decrease (Ctrl -) ----
        if (e.ctrlKey && e.key === '-') {
            e.preventDefault();
            this.saveSelection();
            this.restoreSelection();
            const oldContent = this.snapshot();
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            let el = sel.getRangeAt(0).startContainer;
            if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
            if (!this.editor.contains(el)) el = this.editor;
            const currentPx = parseFloat(window.getComputedStyle(el, null).getPropertyValue('font-size'));
            const minPx = 10; // approx. HTML size 1
            this.applyInlineStyle('font-size', `${Math.max(minPx, currentPx - 2)}px`);
            this.mergeNestedSpans();
            this.pushUndoState(oldContent);
            return;
        }

        // ---- Highlight must not leak into the next word / line ----
        if (e.key === 'Enter' || e.key === ' ') {
            try {
                this.highlightBar.style.backgroundColor = '#ffffff';
                document.execCommand('backColor', false, '#ffffff');
            } catch (error) {
                console.error('Error applying backColor fix on keydown:', error);
            }
        }

        // ---- Enter: new paragraph (pagination adds a page automatically when the line was the last one) ----
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
            this._dedupePageBreak();
            this._clearScriptFormatting();
            let block = sel.getRangeAt(0).startContainer;
            while (block && block.nodeType !== Node.ELEMENT_NODE) block = block.parentNode;
            block = block && block.closest('p, blockquote');
            if (block) {
                block.querySelectorAll('span[style*="background-color"]').forEach(span => {
                    if (span.innerHTML === '<br>' || span.textContent.trim() === '') {
                        const frag = document.createDocumentFragment();
                        while (span.firstChild) frag.appendChild(span.firstChild);
                        span.parentNode.replaceChild(frag, span);
                    }
                });
            }
            // If the old line was the last one of a page, the new line does not fit there:
            // paginate() moves it to the top of the next page (a page is added when needed).
            if (this.pageGuides) this.updatePageGuides();
            this.scrollCaretIntoView();
            this.updateToolbarState();
            return;
        }

        // ---- Backspace at the very start of a block, right after a floating figure: merge past it, deterministically
        // - never letting it merge INTO the figure or delete the figure as an accidental side effect of the merge.
        // Left to the browser's own default behavior here, a non-editable sibling like this is inconsistent: it can
        // silently delete the figure together with the merge, or simply get stuck and do nothing at all.
        if (e.key === 'Backspace' && !this.selectedResizable) {
            const sel = window.getSelection();
            if (sel.rangeCount && sel.isCollapsed) {
                const range = sel.getRangeAt(0);
                let node = range.startContainer;
                if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
                const block = node && node.closest ? node.closest('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre') : null;
                if (block && block.parentElement === this.editor && !block.classList.contains('jc-code')) {
                    const preRange = document.createRange();
                    preRange.setStart(block, 0);
                    preRange.setEnd(range.startContainer, range.startOffset);
                    if (preRange.toString() === '') {
                        const prevFigure = block.previousElementSibling;
                        if (prevFigure && prevFigure.classList.contains('floating')) {
                            e.preventDefault();
                            const flowPrev = prevFigure.previousElementSibling;
                            if (flowPrev && /^(P|DIV|LI|H[1-6]|BLOCKQUOTE|PRE)$/.test(flowPrev.tagName)) {
                                const oldContent = this.snapshot();
                                const caretOffset = flowPrev.textContent.length;
                                const hadOnlyBr = block.innerHTML === '<br>';
                                if (!hadOnlyBr) while (block.firstChild) flowPrev.appendChild(block.firstChild);
                                block.remove();
                                this._setCaretIn(flowPrev, caretOffset);
                                this.pushUndoState(oldContent);
                                if (this.pageGuides) this.updatePageGuides();
                                this.updateToolbarState();
                            }
                            // no flow block before the figure to merge into: do nothing, rather than risk deleting it
                            return;
                        }
                    }
                }
            }
        }

        // ---- Delete: removes the selected image / table ----
        if (e.key === 'Delete' || (e.key === 'Backspace' && this.selectedResizable)) {
            // A selected floating figure (image or handwriting) may have no text caret placed anywhere yet, right
            // after it was inserted - check this FIRST, so Delete removes it immediately, with no need to click
            // it again first just to re-establish a selection.
            if (this.selectedResizable) {
                e.preventDefault();
                const oldContent = this.snapshot();
                this.selectedResizable.remove();
                this.selectedResizable = null;
                this.pushUndoState(oldContent);
                this.updateToolbarState();
                return;
            }
            if (e.key !== 'Delete') return;
            const oldContent = this.snapshot();
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
                        this.pushUndoState(oldContent);
                        this.updateToolbarState();
                        return;
                    }
                }
            }
            this.pushUndoState(oldContent);
        }
    }

    // =====================================================================
    //  CODE MODE  (code block / inline code with colored tokens)
    // =====================================================================

    static _codeSets() {
        if (jCaret.__codeSets) return jCaret.__codeSets;
        const set = str => new Set(str.split(/\s+/).filter(Boolean));
        jCaret.__codeSets = {
            kw: set('abstract as async await break case catch class const continue debugger default delete do else enum export extends final finally for from function func struct defer go chan range select print println printf if implements import in instanceof interface let namespace new of override package private protected public readonly return set static super switch this throw throws try typeof using var void volatile while with yield def elif lambda pass raise except global nonlocal del assert is not and or fn mut pub impl trait use mod match loop where unsafe echo foreach endforeach endif elseif require include'),
            lit: set('true false null undefined nil None True False NaN Infinity'),
            types: set('int long short float double char bool boolean byte string String number any object unsigned signed size_t'),
            sql: set('SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP INDEX JOIN INNER LEFT RIGHT OUTER FULL ON GROUP BY ORDER HAVING LIMIT OFFSET UNION ALL DISTINCT AS AND OR NOT NULL IS IN LIKE BETWEEN EXISTS CASE WHEN THEN ELSE END PRIMARY KEY FOREIGN REFERENCES DEFAULT CONSTRAINT VIEW WITH ASC DESC COUNT SUM AVG MIN MAX'),
            shell: set('if then else elif fi for while do done case esac function in echo cd ls export sudo apt npm git cat grep sed awk chmod mkdir rm cp mv')
        };
        return jCaret.__codeSets;
    }

    /** Guesses the language of a piece of code: 'html' | 'sql' | 'python' | 'shell' | 'css' | 'js' (any C-like language). */
    detectCodeLang(t) {
        if (/<\?php\b/i.test(t)) return 'php';
        if (/^\s*<(!doctype|html|head|body|div|span|p|a|ul|ol|li|table|form|script|style|section|h[1-6]|\?xml)\b/i.test(t) ||
            (/^\s*<[A-Za-z]/.test(t) && /<\/[A-Za-z][\w-]*>/.test(t))) return 'html';
        if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(t) && /\b(FROM|INTO|SET|TABLE|VALUES|WHERE)\b/i.test(t)) return 'sql';
        if (/^\s*#!.*\b(ba)?sh\b/m.test(t) || /^\s*(sudo|apt|npm|git|cd|ls|echo|export|chmod|mkdir)\b/m.test(t)) return 'shell';
        if (/^\s*(def |class \w+.*:|import \w+|from \w+ import|print\()/m.test(t) && !/[;{}]\s*$/m.test(t)) return 'python';
        if (/[.#@]?[\w\-][\w\-.#\s,>:+~*]*\{[^{}]*:[^{}]*;?[^{}]*\}/.test(t) && !/\b(function|=>|return|class|var|let|const)\b/.test(t)) return 'css';
        return 'js';
    }
    _codeLabel() {
        return this.i18n.codeLabel;   // shown on the block itself: always plain "CODE" / "شيفرة", never the guessed language
    }

    /** Returns HTML: the code with <span class="jc-t-..."> around keywords, strings, comments, numbers, functions... */
    highlightCode(text, lang) {
        const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const span = (c, s) => '<span class="jc-t-' + c + '">' + esc(s) + '</span>';
        if (lang === 'html') return this._highlightHtml(text, esc, span);
        const W = jCaret._codeSets();
        const hash = lang === 'python' || lang === 'shell';
        const comment = hash ? /#[^\n]*/
            : lang === 'sql' ? /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/
            : lang === 'css' ? /\/\*[\s\S]*?(?:\*\/|$)/
            : /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/;
        const str = lang === 'python'
            ? /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/
            : /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?/;
        const re = new RegExp('(' + comment.source + ')|(' + str.source + ')|(\\b0[xX][0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)|(\\$?[A-Za-z_][\\w$]*)', 'g');
        let out = '', last = 0, m;
        while ((m = re.exec(text))) {
            if (m.index > last) out += esc(text.slice(last, m.index));
            const t = m[0];
            if (m[1] !== undefined) out += span('com', t);
            else if (m[2] !== undefined) out += span('str', t);
            else if (m[3] !== undefined) out += span('num', t);
            else if (t.charAt(0) === '$') out += span('var', t);
            else if (lang === 'sql' ? W.sql.has(t.toUpperCase()) : (W.kw.has(t) || (lang === 'shell' && W.shell.has(t)))) out += span('kw', t);
            else if (W.lit.has(t)) out += span('num', t);
            else if (lang !== 'sql' && W.types.has(t)) out += span('type', t);
            else if (text.charAt(re.lastIndex) === '(') out += span('fn', t);
            else if (lang !== 'sql' && lang !== 'css' && /^[A-Z][A-Za-z0-9_]*$/.test(t)) out += span('type', t);
            else out += esc(t);
            last = re.lastIndex;
        }
        return out + esc(text.slice(last));
    }
    _highlightHtml(text, esc, span) {
        const re = /<!--[\s\S]*?(?:-->|$)|<\/?[A-Za-z!][^>]*>?/g;
        let out = '', last = 0, m;
        while ((m = re.exec(text))) {
            if (m.index > last) out += esc(text.slice(last, m.index));
            const tok = m[0];
            last = re.lastIndex;
            if (tok.startsWith('<!--')) { out += span('com', tok); continue; }
            const t = /^<(\/?)([A-Za-z!][\w:-]*)([\s\S]*?)(\/?)(>?)$/.exec(tok);
            if (!t) { out += esc(tok); continue; }
            out += span('tag', '<' + t[1] + t[2]);
            const attrs = t[3], ar = /([^\s=\/]+)(\s*=\s*)?("[^"]*"?|'[^']*'?|[^\s"'>]+)?/g;
            let am, al = 0;
            while ((am = ar.exec(attrs))) {
                if (am.index > al) out += esc(attrs.slice(al, am.index));
                out += span('attr', am[1]);
                if (am[2]) out += esc(am[2]);
                if (am[3]) out += span('str', am[3]);
                al = ar.lastIndex;
            }
            out += esc(attrs.slice(al)) + span('tag', t[4] + t[5]);
        }
        return out + esc(text.slice(last));
    }

    /** Plain text of a block: <br> becomes a new line, non-breaking spaces become spaces; a list gives one line per item. */
    _blockText(el) {
        if (/^(UL|OL)$/.test(el.tagName)) return Array.from(el.children).map(li => this._blockText(li)).join('\n');
        const c = el.cloneNode(true);
        c.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        let t = c.textContent.replace(/\u00a0/g, ' ');
        if (el.tagName === 'PRE' && t.endsWith('\n')) t = t.slice(0, -1);    // the display newline of a code block
        return t.replace(/\n$/, '');
    }
    /** Code of a code block (without its display newline). */
    _codeText(pre) {
        pre.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        const t = pre.textContent.replace(/\u00a0/g, ' ');
        return t.endsWith('\n') ? t.slice(0, -1) : t;
    }
    /** Fills a code block. The extra final "\n" only makes the browser draw an empty last line. */
    _fillCode(pre, code) {
        const lang = this.detectCodeLang(code);   // still used to choose which words/syntax get colored
        const html = this.highlightCode(code, lang) + '\n';
        if (pre.innerHTML !== html) pre.innerHTML = html;
        pre.setAttribute('data-lang', lang);
        pre.setAttribute('data-label', this._codeLabel());
    }
    _makeCodeBlock(code) {
        const pre = document.createElement('pre');
        pre.className = 'jc-code';
        pre.setAttribute('dir', 'ltr');
        pre.setAttribute('spellcheck', 'false');
        this._fillCode(pre, code);
        return pre;
    }
    _preAtCaret() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;
        let n = sel.anchorNode;
        if (n && n.nodeType !== 1) n = n.parentElement;
        const pre = n && n.closest ? n.closest('pre.jc-code') : null;
        return pre && this.editor.contains(pre) ? pre : null;
    }
    _offsetIn(root, node, off) {
        const r = document.createRange();
        r.selectNodeContents(root);
        r.setEnd(node, off);
        return r.toString().length;
    }
    _setCaretIn(root, start, end = start) {
        const at = off => {
            const walk = document.createTreeWalker(root, 4);
            let n, acc = 0, lastNode = null;
            while ((n = walk.nextNode())) {
                lastNode = n;
                if (off <= acc + n.nodeValue.length) return [n, off - acc];
                acc += n.nodeValue.length;
            }
            return lastNode ? [lastNode, lastNode.nodeValue.length] : [root, 0];
        };
        const a = at(start);
        const b = end === start ? a : at(end);
        const r = document.createRange();
        r.setStart(a[0], a[1]);
        r.setEnd(b[0], b[1]);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
    }
    _insertTextAtCaret(str) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const tn = document.createTextNode(str);
        r.insertNode(tn);
        r.setStartAfter(tn);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    _scheduleCodeHighlight() {
        clearTimeout(this._codeTimer);
        this._codeTimer = setTimeout(() => this.rehighlightCode(), 250);
    }
    /** Re-colors the code block that holds the caret (called shortly after typing / pasting). */
    rehighlightCode() {
        if (this._composing) return;
        const pre = this._preAtCaret();
        if (!pre) return;
        const sel = window.getSelection();
        const r = sel.getRangeAt(0);
        pre.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        const inside = pre.contains(r.startContainer) && pre.contains(r.endContainer);
        const start = inside ? this._offsetIn(pre, r.startContainer, r.startOffset) : 0;
        const end = inside ? this._offsetIn(pre, r.endContainer, r.endOffset) : 0;
        const code = this._codeText(pre);
        const before = pre.innerHTML;
        this._fillCode(pre, code);
        if (inside && pre.innerHTML !== before) this._setCaretIn(pre, Math.min(start, code.length), Math.min(end, code.length));
    }
    _codeEnter(pre) {
        const sel = window.getSelection();
        const r = sel.getRangeAt(0);
        pre.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        const code = this._codeText(pre);
        const pos = this._offsetIn(pre, r.startContainer, r.startOffset);
        if (r.collapsed && pos >= code.length && code.endsWith('\n')) {
            // Enter on an empty last line: leave the code block
            this._fillCode(pre, code.slice(0, -1));
            let next = pre.nextElementSibling;
            const emptyP = next && next.tagName === 'P' && next.textContent === '' && !next.querySelector('img');
            if (!emptyP) {                                  // a fresh line below the code (never merge into the next paragraph)
                next = document.createElement('p');
                next.innerHTML = '<br>';
                pre.after(next);
            }
            const nr = document.createRange();
            nr.setStart(next, 0);
            nr.collapse(true);
            sel.removeAllRanges();
            sel.addRange(nr);
            this.editor.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            this._insertTextAtCaret('\n');
            this.rehighlightCode();
        }
        if (this.pageGuides) this.updatePageGuides();
        this.scrollCaretIntoView();
    }

    /**
     * @method toggleCode
     * @description Code button. Inside code -> back to normal text. Otherwise the selected text becomes colored code:
     * a code block (whole lines / several lines / caret in a line) or inline code (part of one line).
     * @returns {boolean} true when the document changed
     */
    toggleCode() {
        const ed = this.editor, sel = window.getSelection();
        if (!sel.rangeCount) return false;
        const range = sel.getRangeAt(0);
        const elOf = n => (n && n.nodeType !== 1 ? n.parentElement : n);
        const anchor = elOf(range.commonAncestorContainer);
        if (!anchor || !ed.contains(anchor)) return false;

        // 1. inside code -> back to normal text
        const pre = anchor.closest('pre.jc-code');
        if (pre && ed.contains(pre)) {
            const lines = this._codeText(pre).split('\n');
            const frag = document.createDocumentFragment();
            let lastP = null;
            lines.forEach(line => {
                const p = document.createElement('p');
                if (line === '') p.innerHTML = '<br>';
                else p.textContent = line.replace(/^ +/, m => '\u00a0'.repeat(m.length)).replace(/ {2,}/g, m => ' ' + '\u00a0'.repeat(m.length - 1));
                frag.appendChild(p);
                lastP = p;
            });
            pre.replaceWith(frag);
            this._setCaretIn(lastP, lastP.textContent.length);
            return true;
        }
        const inl = anchor.closest('code.jc-code-inline');
        if (inl && ed.contains(inl)) {
            const tn = document.createTextNode(inl.textContent);
            inl.replaceWith(tn);
            const r = document.createRange();
            r.selectNodeContents(tn);
            sel.removeAllRanges();
            sel.addRange(r);
            return true;
        }

        // 2. what does the selection cover?
        const topOf = n => { let e = elOf(n); while (e && e.parentElement !== ed) e = e.parentElement; return e; };
        const first = topOf(range.startContainer), lastB = topOf(range.endContainer);
        if (!first || !lastB) return false;
        const all = Array.from(ed.children);
        const blocks = all.slice(all.indexOf(first), all.indexOf(lastB) + 1);
        const textBlock = b => /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|UL|OL)$/.test(b.tagName);
        const selText = range.toString();

        // inline code: part of ONE line of ONE text block (or anything inside a list / table cell)
        const nested = elOf(range.startContainer).closest('li, td, th');
        const partial = blocks.length === 1 && !range.collapsed && !selText.includes('\n') &&
            selText.trim() !== this._blockText(first).trim();
        if (!range.collapsed && (nested || (partial && textBlock(first) && !/^(UL|OL)$/.test(first.tagName)))) {
            const code = document.createElement('code');
            code.className = 'jc-code-inline';
            code.setAttribute('spellcheck', 'false');
            code.innerHTML = this.highlightCode(selText, this.detectCodeLang(selText));
            range.deleteContents();
            range.insertNode(code);
            const r = document.createRange();          // keep the new inline code selected (so the button shows "on"
            r.selectNodeContents(code);                 // and a second click turns it back into normal text)
            sel.removeAllRanges();
            sel.addRange(r);
            return true;
        }

        // code block over whole blocks
        if (nested || !blocks.every(textBlock)) return false;
        const text = blocks.map(b => this._blockText(b)).join('\n');
        const block = this._makeCodeBlock(text);
        first.before(block);
        blocks.forEach(b => b.remove());
        if (!block.nextElementSibling) {                // always leave a normal line below, to keep typing
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            block.after(p);
        }
        this._setCaretIn(block, text.length);
        return true;
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
     * @method normalizeUrl
     * @description Turns what the user typed into a real, absolute link: "example.com" -> "https://example.com",
     * "me@mail.com" -> "mailto:me@mail.com". Links with a scheme, "#anchors" and "/paths" are left alone.
     * (A scheme-less href would otherwise be resolved against the address of the page that hosts the editor.)
     */
    normalizeUrl(url) {
        url = String(url || '').trim();
        if (!url) return '';
        if (/^[#\/.]/.test(url) && !url.startsWith('//')) return url;          // "#x", "/x", "./x", "../x"
        if (url.startsWith('//')) return 'https:' + url;
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) || /^(mailto|tel|sms|callto|geo):/i.test(url)) return url;
        if (/^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(url)) return 'mailto:' + url;
        return 'https://' + url;
    }

    /**
     * @method linkifyPlainUrls
     * @description Print copy only: web addresses and e-mail addresses typed as plain text (https://..., www...., a@b.com)
     * become real <a href> links, so they are clickable in the saved PDF. Existing links are not touched.
     */
    linkifyPlainUrls(root) {
        const doc = root.ownerDocument;
        const re = /(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]+|[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}/g;
        const trim = t => {
            for (;;) {                                   // trailing punctuation / unbalanced ")" is not part of the address
                const last = t.slice(-1);
                if (/[.,;:!?'\]]/.test(last) || (last === ')' && (t.match(/\(/g) || []).length < (t.match(/\)/g) || []).length)) t = t.slice(0, -1);
                else return t;
            }
        };
        const nodes = [];
        const tw = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
        let n;
        while ((n = tw.nextNode())) {
            if (n.parentElement && !n.parentElement.closest('a, pre, code')) nodes.push(n);
        }
        nodes.forEach(node => {
            const text = node.nodeValue;
            re.lastIndex = 0;
            let m, last = 0, frag = null;
            while ((m = re.exec(text))) {
                const url = trim(m[0]);
                if (!url) continue;
                frag = frag || doc.createDocumentFragment();
                if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
                const a = doc.createElement('a');
                a.setAttribute('href', this.normalizeUrl(url));
                a.textContent = url;
                frag.appendChild(a);
                last = m.index + url.length;
                re.lastIndex = last;
            }
            if (!frag) return;
            if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
            node.parentNode.replaceChild(frag, node);
        });
    }

    /**
     * @method isURL
     * @description Checks if given text is a URL form.
     */
    isURL(url) {
        const expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        return url.match(new RegExp(expression));
    }

    // =====================================================================
    //  PRINT / PDF
    // =====================================================================

    /** True if a canvas has any real transparency (a genuinely non-opaque pixel), not just a fully opaque image. */
    _hasTransparency(ctx, w, h) {
        try {
            const data = ctx.getImageData(0, 0, w, h).data;
            for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
            return false;
        } catch (_) { return false; }   // e.g. a tainted canvas: assume opaque rather than risk losing the image
    }
    /**
     * @method optimizeImageForPrint
     * @description Re-encodes a data-URL image, downscaled, so the PDF stays small. An image with real
     * transparency (a PNG or WEBP with any non-opaque pixel) is kept as WEBP (it compresses about as well as
     * JPEG and still supports an alpha channel), so a transparent area - over a table, say - stays transparent
     * in the printed PDF exactly as it already did in the downloaded PNG. An opaque photo is still turned into a
     * JPEG, since that compresses noticeably smaller and has no transparency to lose in the first place.
     */
    optimizeImageForPrint(img, maxWidth = 1400, quality = 0.82) {
        return new Promise(resolve => {
            const src = img.getAttribute('src') || '';
            if (!src.startsWith('data:image/') || src.startsWith('data:image/svg') || src.startsWith('data:image/gif')) {
                return resolve();
            }
            const tmp = new Image();
            tmp.onload = () => {
                try {
                    let w = tmp.naturalWidth, h = tmp.naturalHeight;
                    if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
                    const c = document.createElement('canvas');
                    c.width = w; c.height = h;
                    const ctx = c.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(tmp, 0, 0, w, h);   // onto a transparent canvas - nothing painted behind it yet
                    const hasAlpha = this._hasTransparency(ctx, w, h);
                    let optimized;
                    if (hasAlpha) {
                        optimized = c.toDataURL('image/webp', quality);
                        if (!optimized.startsWith('data:image/webp')) optimized = c.toDataURL('image/png');   // a browser that ignores the webp request falls back to a lossless one, still with alpha
                    } else {
                        ctx.globalCompositeOperation = 'destination-over';
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, w, h);   // opaque photo: a plain white backdrop compresses best as JPEG
                        optimized = c.toDataURL('image/jpeg', quality);
                    }
                    if (optimized.length < src.length) img.setAttribute('src', optimized);
                } catch (_) { /* keep original */ }
                resolve();
            };
            tmp.onerror = () => resolve();
            tmp.src = src;
        });
    }

    /**
     * @method printAsPDF
     * @description Opens the print dialog with a print-only copy of the document. The copy is laid out with the SAME
     * paginate() as the editor (A4 sheets, each page with its own margins), so the PDF matches the screen.
     * Choose "Save as PDF" as the destination.
     */
    printAsPDF() {
        const hasContent = this.editor.textContent.trim() !== '' ||
            this.editor.querySelector('img, table');
        if (!hasContent) {
            // nothing to print: say so (and remind that pages are A4)
            this.printEmptyModal.classList.remove('hidden');
            this.printEmptyModal.querySelector('#closePrintEmpty').focus();
            return;
        }
        // Tell the user how to save so that links stay clickable (Destination: Save as PDF), unless they opted out
        let hidden = false;
        try { hidden = localStorage.getItem('jCaretPrintTipHidden') === '1'; } catch (_) {}
        if (hidden) return this._printNow();
        this.printTipModal.querySelector('#printTipDontShow').checked = false;
        this.printTipModal.classList.remove('hidden');
        this.printTipModal.querySelector('#continuePrintTip').focus();
    }

    /**
     * @method downloadPageAsPNG
     * @description Renders ONE page (its content, table borders, images, list markers and its own margins) onto a
     * canvas and downloads it as a PNG, without any external library. Chrome (unlike Firefox) refuses to rasterize
     * an SVG's <foreignObject> HTML content whenever that SVG is used as an image source, so the usual "serialize
     * the page as one big SVG" trick renders blank there; this instead paints backgrounds, borders, images, list
     * markers and every run of text directly onto the canvas, using the browser's own layout (each text node's real,
     * already-wrapped line boxes) so wrapping and RTL/LTR order come out correct. A custom @font-face family may
     * fall back to a default font in the image; color, size, weight, italics and alignment are unaffected.
     * @param {number} pageIndex 0-based page to export.
     */
    async downloadPageAsPNG(pageIndex) {
        const MM = jCaret.MM, P = (jCaret.PAGE_H - 1) * MM, S = P;   // no visual gap here: same page pitch as print
        const widthPx = this.editor.clientWidth;
        const scale = 3;   // render at 3x for a crisp, print-quality PNG

        // 1. a clean copy of the whole document, attached off-screen and laid out exactly like the live editor, so
        // this page's slice (margins, page breaks) lines up with what is shown on screen.
        const clone = this.editor.cloneNode(true);
        clone.querySelectorAll('.resize-handle, .rotate-handle, .rotate-handle-stem').forEach(el => el.remove());
        clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
        clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        this.clearLayoutMarks(clone);
        // keep id="editor": every layout rule this component injects is scoped to "#editor ...", so margins, table
        // sizing, code-block colors etc. would silently stop applying without it. The host is removed again below,
        // so there is never more than one element with this id on the page at the same time.
        clone.style.cssText = `width:${widthPx}px; margin:0; padding:${this.getPageMargins(0).top}mm 0 0 0; box-sizing:border-box; background:#fff; direction:${this.dir};`;
        const host = document.createElement('div');
        host.style.cssText = `position:fixed; left:-99999px; top:0; width:${widthPx}px;`;
        host.appendChild(clone);
        document.body.appendChild(host);
        // this.editor's own page count (this._totalPages) can be one animation frame behind a margin change just
        // made through the panel (it is recomputed on a debounce); pagination here is done fresh on the clone, and
        // ITS result - not the possibly-stale this._totalPages - decides the page count, and so the margins used.
        // Same paginate() call as the printed PDF (gap 0, a little slack against rounding) - not the on-screen
        // default (which leaves a visible gap between sheets) - so a page break falls in exactly the same place
        // here as it does on paper, and this page's margins are never computed against a different page height.
        const { total } = this.paginate(clone, 1, 0, 2);
        const k = Math.min(Math.max(0, pageIndex), total - 1);

        // images must finish loading before drawImage() can read their pixels
        await Promise.all(Array.from(clone.querySelectorAll('img')).map(img => img.complete ? Promise.resolve() :
            new Promise(res => { img.onload = img.onerror = res; })));

        // 2. canvas for exactly this one page; toLocal() maps a getBoundingClientRect() into "page k" coordinates
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(widthPx * scale);
        canvas.height = Math.round(P * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);

        const cloneRect = clone.getBoundingClientRect();
        const yTop = k * S;
        const toLocal = r => ({ x: r.left - cloneRect.left, y: r.top - cloneRect.top - yTop, w: r.width, h: r.height, bottom: r.bottom - cloneRect.top - yTop });
        const within = r => r.bottom > -2 && r.y < P + 2;   // skip anything that falls outside this page's window

        // A rotated figure's image and caption are drawn correctly by NOT drawing them rotated at all: capture
        // each one's rotation angle and center (a figure's center is exactly the same point whether it is rotated
        // or not, since CSS rotates it about its own center), remove the rotation from the clone, then wrap only
        // the drawing of that figure's own content in a matching canvas rotation. Drawing the image directly
        // using the rotated bounding box's (angle-swapped) width and height - as this used to do - stretched or
        // squashed it, and a caption was not rotated to match the image at all.
        const figureRotation = new Map();
        clone.querySelectorAll('.floating').forEach(fig => {
            const deg = parseFloat(fig.dataset.rotate) || 0;
            if (!deg) return;
            const r = toLocal(fig.getBoundingClientRect());
            figureRotation.set(fig, { deg, cx: r.x + r.w / 2, cy: r.y + r.h / 2 });
            fig.style.transform = 'none';
        });
        const rotationFor = el => {
            const fig = el.closest ? el.closest('.floating') : null;
            return fig ? figureRotation.get(fig) : null;
        };
        const withRotation = (el, draw) => {
            const rot = rotationFor(el);
            if (!rot) { draw(); return; }
            ctx.save();
            ctx.translate(rot.cx, rot.cy);
            ctx.rotate(rot.deg * Math.PI / 180);
            ctx.translate(-rot.cx, -rot.cy);
            draw();
            ctx.restore();
        };
        this._rotationFor = rotationFor;
        this._withRotation = withRotation;

        this._paintBackgroundsAndBorders(clone, ctx, toLocal, within, P);
        this._paintWatermarkForPage(ctx, k, P);
        // A canvas's drawn pixels are not part of cloneNode() either (same as with saving) - redraw every ink
        // figure's canvas in the clone from its stored stroke data before reading any of them for the export.
        this._rehydrateInk(clone);
        clone.querySelectorAll('img, canvas').forEach(el => {
            // rotation has already been stripped from the clone, so this is the figure's true, un-rotated box
            const r = toLocal(el.getBoundingClientRect());
            if (!within(r) || !r.w || !r.h) return;
            withRotation(el, () => { try { ctx.drawImage(el, r.x, r.y, r.w, r.h); } catch (_) { /* e.g. a broken image: skip it */ } });
        });
        this._paintListMarkers(clone, ctx, toLocal, within);
        this._paintText(clone, ctx, toLocal, within);
        this._paintCodeLabels(clone, ctx, toLocal, within);
        this._paintPageNumber(ctx, k, total);

        host.remove();

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `page-${k + 1}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    /** Every visual LINE of one text node, as {text, rect} in document order - even a line broken only by wrapping
     * (there is no single DOM offset for that), by re-using the same per-character rect search as _splitUnit. */
    _textLines(node) {
        const text = node.nodeValue;
        const total = text.length;
        if (!total) return [];
        const range = document.createRange();
        const rectAt = i => {
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const rs = range.getClientRects();
            for (let j = 0; j < rs.length; j++) if (rs[j].height > 0.5 && rs[j].width > 0) return rs[j];
            return null;
        };
        const firstDrawn = from => { for (let i = from; i < total; i++) { const r = rectAt(i); if (r) return i; } return -1; };
        const sameLine = (a, c) => Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 0.5 * Math.min(a.bottom - a.top, c.bottom - c.top);
        const lines = [];
        let i = firstDrawn(0);
        while (i !== -1 && i < total) {
            const ref = rectAt(i);
            let end = i + 1, lastGood = i;
            while (end < total) {
                const r = rectAt(end);
                if (r && sameLine(r, ref)) { lastGood = end; end++; }
                else if (r) break;                 // a real character on the next line: this line is done
                else end++;                        // an undrawn character (e.g. a wrapped space): keep looking
            }
            // the bounding box of the WHOLE line (not just its last character)
            range.setStart(node, i);
            range.setEnd(node, lastGood + 1);
            lines.push({ text: text.slice(i, lastGood + 1), rect: range.getBoundingClientRect() });
            i = firstDrawn(end);
        }
        return lines;
    }

    /** Builds a canvas font string ("italic bold 14px Arial, sans-serif") from an element's computed style. */
    _cssFont(el) {
        const cs = getComputedStyle(el);
        return `${cs.fontStyle === 'normal' ? '' : cs.fontStyle + ' '}${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    }

    /** Paints every element's background color and border (mainly table/code-block backgrounds and table borders). */
    _paintBackgroundsAndBorders(root, ctx, toLocal, within, pageH) {
        const withRotation = this._withRotation || ((el, draw) => draw());
        root.querySelectorAll('*').forEach(el => {
            const raw = toLocal(el.getBoundingClientRect());
            if (!within(raw) || !raw.w || !raw.h) return;
            // An element that is split across a page break (a code block or paragraph too tall for one page) still
            // reports its FULL, multi-page height here, since the split is just an internal spacer, not a separate
            // DOM element - clip its fill/border to THIS page's own window, or its background would bleed straight
            // through the bottom margin and onto the next page's share of it.
            const y0 = Math.max(0, raw.y), y1 = Math.min(pageH, raw.bottom);
            if (y1 <= y0) return;
            const rect = { x: raw.x, w: raw.w, y: y0, h: y1 - y0, bottom: y1 };
            const cs = getComputedStyle(el);
            const bg = cs.backgroundColor;
            withRotation(el, () => {
            if (bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(bg)) {
                ctx.fillStyle = bg;
                ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            }
            if (/^(TD|TH|TABLE)$/.test(el.tagName)) {
                ['Top', 'Right', 'Bottom', 'Left'].forEach(side => {
                    const w = parseFloat(cs[`border${side}Width`]);
                    if (!w || cs[`border${side}Style`] === 'none') return;
                    // only draw the top/bottom edge when it is actually still inside this page's window
                    if (side === 'Top' && raw.y < y0 - 0.5) return;
                    if (side === 'Bottom' && raw.bottom > y1 + 0.5) return;
                    ctx.strokeStyle = cs[`border${side}Color`];
                    ctx.lineWidth = w;
                    ctx.beginPath();
                    if (side === 'Top') { ctx.moveTo(rect.x, rect.y + w / 2); ctx.lineTo(rect.x + rect.w, rect.y + w / 2); }
                    else if (side === 'Bottom') { ctx.moveTo(rect.x, rect.y + rect.h - w / 2); ctx.lineTo(rect.x + rect.w, rect.y + rect.h - w / 2); }
                    else if (side === 'Left') { ctx.moveTo(rect.x + w / 2, rect.y); ctx.lineTo(rect.x + w / 2, rect.y + rect.h); }
                    else { ctx.moveTo(rect.x + rect.w - w / 2, rect.y); ctx.lineTo(rect.x + rect.w - w / 2, rect.y + rect.h); }
                    ctx.stroke();
                });
            }
            });
        });
    }

    /** Approximate bullets ("•") for <ul><li> and numbers ("1.", "2." ...) for <ol><li>. */
    _paintListMarkers(root, ctx, toLocal, within) {
        root.querySelectorAll('ul, ol').forEach(list => {
            const ordered = list.tagName === 'OL';
            let n = ordered ? (parseInt(list.getAttribute('start'), 10) || 1) : 0;
            Array.from(list.children).forEach(li => {
                if (li.tagName !== 'LI') return;
                const r = toLocal(li.getBoundingClientRect());
                if (within(r) && r.w && r.h) {
                    const cs = getComputedStyle(li);
                    ctx.font = this._cssFont(li);
                    ctx.fillStyle = cs.color;
                    ctx.textBaseline = 'alphabetic';
                    const baseline = r.y + parseFloat(cs.fontSize) * 0.85;
                    const rtl = cs.direction === 'rtl';
                    const marker = ordered ? `${n}.` : '\u2022';
                    const mw = ctx.measureText(marker).width;
                    ctx.fillText(marker, rtl ? r.x + r.w + 6 : r.x - mw - 6, baseline);
                }
                if (ordered) n++;
            });
        });
    }

    /** Paints every run of text along the browser's own (already correctly wrapped / bidi-ordered) line boxes. */
    _paintText(root, ctx, toLocal, within) {
        const withRotation = this._withRotation || ((el, draw) => draw());
        const tw = document.createTreeWalker(root, 4 /* SHOW_TEXT */);
        let node;
        while ((node = tw.nextNode())) {
            if (!node.nodeValue || !node.nodeValue.trim()) continue;
            const parent = node.parentElement;
            if (!parent || parent.closest('.jcaret-page-guides, .jcaret-page-badge')) continue;
            const cs = getComputedStyle(parent);
            if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            const rtl = cs.direction === 'rtl';
            ctx.font = this._cssFont(parent);
            ctx.fillStyle = cs.color;
            ctx.textBaseline = 'alphabetic';
            // The already-laid-out bounding box (from the real DOM) is the source of truth, not canvas's own bidi
            // reordering: for an RTL run, anchor at its RIGHT edge and align text to the right of that point.
            ctx.direction = rtl ? 'rtl' : 'ltr';
            ctx.textAlign = rtl ? 'right' : 'left';
            const deco = cs.textDecorationLine || cs.textDecoration || '';
            this._textLines(node).forEach(({ text, rect }) => {
                const r = toLocal(rect);
                if (!within(r) || !r.w) return;
                const baseline = r.y + r.h * 0.8;
                withRotation(parent, () => {
                    ctx.fillText(text, rtl ? r.x + r.w : r.x, baseline);
                    if (deco.includes('underline')) this._decoLine(ctx, r, baseline + 2, cs.color);
                    if (deco.includes('line-through')) this._decoLine(ctx, r, r.y + r.h * 0.5, cs.color);
                });
            });
        }
    }
    /** The small "CODE" / "شيفرة" corner tag on a code block: a CSS ::before, so a DOM walk never sees it. */
    _paintCodeLabels(root, ctx, toLocal, within) {
        root.querySelectorAll('pre.jc-code[data-label]').forEach(pre => {
            const r = toLocal(pre.getBoundingClientRect());
            if (!within(r) || !r.w) return;
            const cs = getComputedStyle(pre);
            const pad = parseFloat(cs.paddingRight) || 14;
            ctx.font = '600 9px Arial, sans-serif';
            ctx.fillStyle = '#8c959f';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'alphabetic';
            ctx.direction = 'ltr';
            ctx.fillText(pre.dataset.label, r.x + r.w - pad + 4, r.y + 11);
        });
        ctx.textAlign = 'left';
    }

    /** The watermark text, centered and rotated across the page, drawn behind everything else (same look on
     * screen, in print and here) - one setting for the whole document, present on this page whether it already
     * existed or was only just added. */
    _paintWatermarkForPage(ctx, k, pageHeightPx) {
        if (!this.watermark.text) return;
        const w = this.watermark;
        ctx.save();
        ctx.translate(this.editor.clientWidth / 2, pageHeightPx / 2);
        ctx.rotate(w.angle * Math.PI / 180);
        ctx.font = `700 ${w.fontSize}px Arial, sans-serif`;
        ctx.fillStyle = w.color;
        ctx.globalAlpha = w.opacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.direction = 'ltr';
        ctx.fillText(w.text, 0, 0);
        ctx.restore();
    }

    /** The "1 / N" page-number badge, drawn the same way it is shown on screen and in the printed PDF. */
    _paintPageNumber(ctx, k, total) {
        const MM = jCaret.MM;
        const P = jCaret.PAGE_H * MM;
        // fixed distance from the page's bottom edge, exactly like on screen and in the printed PDF - not scaled
        // to the margin, so it stays anchored near the edge instead of drifting up into a big margin
        const y = P - jCaret.PAGE_NUM_OFFSET * MM;
        const x = (jCaret.PAGE_W * MM) - this.pageNumberInset * MM;
        ctx.font = '10pt Arial, sans-serif';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'right';
        // 'top': the glyph's own top lines up with y, matching how the on-screen/print page number is positioned -
        // a CSS element's "top" property sets where its line box (and so its text) STARTS, not its middle.
        // 'middle' here would visually sit noticeably higher (further from the edge) than the print/on-screen version.
        ctx.textBaseline = 'top';
        ctx.direction = 'ltr';
        ctx.fillText(`${k + 1} / ${total}`, x, y);
        ctx.textAlign = 'left';
    }

    _decoLine(ctx, r, y, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, r.h * 0.06);
        ctx.beginPath();
        ctx.moveTo(r.x, y);
        ctx.lineTo(r.x + r.w, y);
        ctx.stroke();
        ctx.restore();
    }

    /** Builds the print copy and opens the browser's print dialog (see printAsPDF). */
    async _printNow() {
        const PH = jCaret.PAGE_H, MM = jCaret.MM;

        // 1. Clean clone of the content
        const clone = this.editor.cloneNode(true);
        clone.querySelectorAll('.resize-handle, .rotate-handle, .rotate-handle-stem').forEach(el => el.remove());
        clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
        clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        this.clearLayoutMarks(clone);
        // Links stay clickable in the saved PDF: give every link a real absolute address, and turn plain-text
        // web / e-mail addresses into links.
        clone.querySelectorAll('a[href]').forEach(a => a.setAttribute('href', this.normalizeUrl(a.getAttribute('href'))));
        this.linkifyPlainUrls(clone);
        clone.removeAttribute('contenteditable');
        clone.removeAttribute('class');
        clone.removeAttribute('style');
        clone.id = 'editor';

        // 2. Shrink images
        await Promise.all(Array.from(clone.querySelectorAll('img')).map(img => this.optimizeImageForPrint(img)));

        // 3. Reuse page styles (Tailwind, fonts, editor CSS + page-layout rules)
        const headStyles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
            .map(n => n.outerHTML).join('\n');

        const printCss = `
            /* margin:0 removes the browser's date/title/URL header & footer */
            @page { size: A4; margin: 0; }
            html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
            /* flow-root: a block's margin can never collapse through the body / editor and shift the sheets */
            body { position: relative; width: 210mm; display: flow-root; }
            html, body { overflow-x: clip; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            #editor {
                width: 210mm !important; box-sizing: border-box !important;
                height: auto !important; max-height: none !important; min-height: 0 !important;
                overflow: visible !important; border: none !important; box-shadow: none !important;
                padding: ${this.getPageMargins(0).top}mm 0 0 0 !important; margin: 0 !important;
                background: #fff !important;
                direction: ${this.dir}; word-wrap: break-word; overflow-wrap: anywhere;
                display: flow-root; overflow-x: clip;
            }
            #editor > :first-child { margin-top: 0 !important; }
            #editor > :last-child { margin-bottom: 0 !important; }
            .resize-handle { display: none !important; }
            #editor img { max-width: 100% !important; height: auto; }
            #editor table { border-collapse: collapse; }
            #editor tr, #editor td { break-inside: avoid; page-break-inside: avoid; }
            #editor h1, #editor h2, #editor h3, #editor blockquote { break-after: avoid; }
            #editor p { orphans: 3; widows: 3; }
            #editor a { color: #0645ad; text-decoration: underline; }
            .page-num { position: absolute; direction: ltr; font: 10pt Arial, sans-serif; color: #555; line-height: 1; }
        `;

        // 4. Hidden iframe (A4 wide, so the measured layout equals the printed layout)
        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.setAttribute('scrolling', 'no');   // a scrollbar would narrow the layout of the print copy
        iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;overflow:hidden;';
        document.body.appendChild(iframe);

        const loaded = new Promise(res => { iframe.onload = res; setTimeout(res, 4000); });
        const doc = iframe.contentDocument;
        doc.open();
        doc.write(`<!DOCTYPE html>
<html lang="${this.language}" dir="${this.dir}">
<head>
<meta charset="utf-8">
<base href="${document.baseURI}">
<title> </title>
${headStyles}
<style>${printCss}</style>
</head>
<body dir="${this.dir}">${clone.outerHTML}</body>
</html>`);
        doc.close();
        await loaded;

        // 5. Wait for fonts + images so the measurement is final
        try {
            await Promise.race([doc.fonts.ready, new Promise(r => setTimeout(r, 3000))]);
            await Promise.all(Array.from(doc.images).map(i => i.decode ? i.decode().catch(() => {}) : Promise.resolve()));
        } catch (_) {}

        // 6. Lay the copy out page by page (per-page margins), then number the pages
        const ed = doc.getElementById('editor');
        // A canvas's pixels are never part of the HTML that was just written into this iframe (same reason saving
        // and re-loading loses them) - redraw every ink figure here, in the iframe's own document, before anything
        // is measured or printed.
        this._rehydrateInk(ed);
        this.paginate(ed, 1, 0, 2);              // sheets touch each other on paper: no gap
        const { total } = this.paginate(ed, 1, 0, 2);
        // Margins that cross a page boundary are dropped by the browser's own pagination, so on paper every page
        // start is made explicit: a real, fixed-height spacer (= that page's top margin) after a forced page break.
        // A paragraph that was broken between two lines becomes two real blocks, the second one starting a page.
        ed.querySelectorAll('span[data-jc-brk]').forEach(sp => {
            const kk = parseInt(sp.getAttribute('data-jc-brk'), 10) || 1;
            const block = sp.closest('p, li, pre');
            if (!block || !ed.contains(block)) { sp.remove(); return; }
            const chain = [];
            for (let n = sp.parentNode; n && n !== block; n = n.parentNode) chain.push(n);
            const tail = block.cloneNode(false);
            tail.removeAttribute('id');
            tail.removeAttribute('data-jc-break');
            let tgt = tail;
            for (let i = chain.length - 1; i >= 0; i--) {
                const c = chain[i].cloneNode(false);
                tgt.appendChild(c);
                tgt = c;
            }
            let n = sp;
            for (let i = 0; i <= chain.length; i++) {
                while (n.nextSibling) tgt.appendChild(n.nextSibling);
                if (i < chain.length) { n = chain[i]; tgt = tgt.parentNode; }
            }
            sp.remove();
            tail.setAttribute('data-jc-pb', String(kk));
            if (tail.tagName === 'LI') {                   // continuation of a list item: no bullet / number
                tail.style.setProperty('list-style', 'none');
                tail.style.setProperty('display', 'block');
            } else if (block.parentElement === ed) {
                this._applySide(tail, kk, 1, ed);
            }
            block.parentNode.insertBefore(tail, block.nextSibling);
        });
        // anchors[k] = an element that sits exactly at the top of page k (the page number and watermark for
        // page k are children of it, positioned with plain CSS - not measured via JavaScript, since page breaks
        // only take real effect once the page is actually printed, never in this still-on-screen iframe, so
        // measuring anything here would measure the wrong, unpaginated layout). It also doubles as the actual
        // page-break spacer, so the browser fragments content at exactly the right place. The very first anchor
        // is appended AFTER #editor (not before, as originally): #editor is now position:relative (for floating
        // figures), and a positioned sibling placed before a positioned element like that can end up painted
        // underneath its background instead of above it.
        const anchors = {};
        const first = doc.createElement('div');
        // position:relative keeps it exactly where it is in the normal flow (the very top of the document, since
        // it goes in right before #editor) - that is what makes "top: 0" inside it mean "the top of page 0". A
        // z-index is enough to still have it (and its children) paint above #editor's own background without
        // having to move it in the DOM, which would break that "top of page 0" anchoring.
        first.style.cssText = 'position:relative;height:0;margin:0;padding:0;border:0;z-index:5;';
        doc.body.insertBefore(first, ed);
        anchors[0] = first;
        ed.querySelectorAll('[data-jc-pb]').forEach(el => {
            const k = parseInt(el.getAttribute('data-jc-pb'), 10) || 0;
            const sp = doc.createElement('div');
            sp.setAttribute('data-print-spacer', '1');
            // (0.02px of padding: an empty 0-height box would let the previous block's bottom margin slip onto the new page)
            sp.style.cssText = `display:block !important;position:relative;z-index:5;box-sizing:content-box;height:max(0px, calc(${this.getPageMargins(k).top}mm - 0.02px)) !important;min-height:0 !important;` +
                'margin:0 !important;padding:0.02px 0 0 0 !important;border:0 !important;break-before:page;page-break-before:always;';
            if (!anchors[k]) anchors[k] = sp;
            el.parentNode.insertBefore(sp, el);
            el.removeAttribute('data-jc-pb');
            el.style.removeProperty('--jc-pb');
            el.style.setProperty('margin-top', '0', 'important');
        });

        for (let i = 0; i < total; i++) {
            // the anchor sits at the top of page i, so the offset is measured inside the page (no drift from page to page);
            // a page that starts in the middle of a very tall block has no anchor and is measured from the top of the document
            const host = anchors[i] || doc.body;
            const base = anchors[i] ? 0 : i * PH;
            const num = doc.createElement('div');
            num.className = 'page-num';
            num.style.position = 'absolute';
            num.style.right = `${this.pageNumberInset}mm`;   // fixed, independent of the page's right margin
            num.textContent = `${i + 1} / ${total}`;
            // fixed distance from the page's bottom edge, same constant used on screen and in the PNG export
            num.style.top = `calc(${base + PH}mm - ${jCaret.PAGE_NUM_OFFSET}mm)`;
            host.appendChild(num);
            if (this.watermark.text) {
                const wm = doc.createElement('div');
                wm.style.cssText = `position:absolute;left:0;right:0;top:${base}mm;height:${PH}mm;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;`;
                const span = doc.createElement('span');
                span.textContent = this.watermark.text;
                span.style.cssText = `transform:rotate(${this.watermark.angle}deg);white-space:nowrap;font:700 ${this.watermark.fontSize}px Arial, sans-serif;color:${this.watermark.color};opacity:${this.watermark.opacity};`;
                wm.appendChild(span);
                host.appendChild(wm);
            }
        }

        // 7. Print + cleanup
        const win = iframe.contentWindow;
        const cleanup = () => { setTimeout(() => iframe.remove(), 500); };
        win.addEventListener('afterprint', cleanup, { once: true });
        setTimeout(() => { if (iframe.isConnected) iframe.remove(); }, 120000);
        win.focus();
        win.print();
    }

    // =====================================================================
    //  TOOLBAR STATE / STORAGE / TABLES
    // =====================================================================

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
            if (node) {
                isInBlockquote = node.closest('blockquote') !== null;
                isInTable = node.closest('td') !== null || !!(this.selectedResizable && this.selectedResizable.querySelector('table'));
            }
        }
        // Inside a code block or inline code, text formatting makes no sense (code has its own coloring), so every
        // such control is disabled - only Code itself (to leave code), Undo/Redo and the page-level controls stay on.
        const inCode = !!(node && node.closest && node.closest('pre.jc-code, code.jc-code-inline') && this.editor.contains(node));
        this.tableOperationsButton.disabled = !isInTable || inCode;
        const codeAllowed = ['undo', 'redo', 'codeBlock', 'printPdf', 'clearAll', 'addPage', 'pageMargins', 'showInfo'];
        const skip = ['undo', 'redo', 'createLink', 'unlink', 'removeFormat', 'printPdf', 'clearAll', 'addPage', 'pageMargins', 'showInfo'];
        commandButtons.forEach(btn => {
            const cmd = btn.dataset.command;
            btn.disabled = inCode && !codeAllowed.includes(cmd);
            if (skip.includes(cmd)) return;
            if (cmd === 'insertBlockquote') {
                btn.classList.toggle('is-active', isInBlockquote);
                return;
            }
            if (cmd === 'codeBlock') {
                btn.classList.toggle('is-active', inCode);
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
        // Controls that are not plain data-command buttons (dropdowns, the color swatches, the insert-table trigger)
        [this.fontNameButton, this.fontSizeSelect, this.fontColorInput,
         this.highlightButton, this.alignmentButton, this.emojiButton, this.imageUploadButton]
            .forEach(el => { if (el) el.disabled = inCode; });
        // <label> has no real "disabled" of its own (fontColorInput above is what actually blocks the color picker);
        // this only dims it and blocks clicks so it looks and behaves consistently disabled too.
        if (this.foreColorLabel) this.foreColorLabel.classList.toggle('jc-disabled', inCode);
        if (this.marginsBtn) this.marginsBtn.classList.toggle('is-active', !!(this.marginPanel && !this.marginPanel.hidden));
        if (!inCode) {
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
        }   // inCode: both were already disabled by the loop above and must stay that way
        try {
            const n = document.queryCommandValue('fontName').replace(/["']/g, '').toLowerCase();
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
            this.fontSizeSelect.value = document.queryCommandValue('fontSize') || '';
        } catch (_) {
            this.fontSizeSelect.value = '';
        }

        // Alignment icon
        let align = this.language === 'ar' ? 'justifyRight' : 'justifyLeft';
        try {
            if (this.selectedResizable) {
                if (this.selectedResizable.classList.contains('center')) align = 'justifyCenter';
                else if (this.selectedResizable.classList.contains('right')) align = 'justifyLeft';
                else if (this.selectedResizable.classList.contains('left')) align = 'justifyRight';
                else if (this.selectedResizable.classList.contains('full')) align = 'justifyFull';
            } else if (isInTable && node && node.closest('td')) {
                const td = node.closest('td');
                const blk = node.closest('p, li, blockquote, div, h1, h2, h3, h4, h5, h6');
                const el = blk && td.contains(blk) ? blk : td;
                let currentAlign = el.style.textAlign || td.style.textAlign || (this.language === 'ar' ? 'right' : 'left');
                if (currentAlign === 'start') currentAlign = getComputedStyle(el).direction === 'rtl' ? 'right' : 'left';
                else if (currentAlign === 'end') currentAlign = getComputedStyle(el).direction === 'rtl' ? 'left' : 'right';
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
        } catch (_) {}
        this.alignmentButton.innerHTML = this.alignmentIcons[align];

        // Colour swatches
        try {
            const currentBack = document.queryCommandValue('backColor');
            const currentFore = document.queryCommandValue('foreColor');
            if (currentBack) {
                const hex = this.colorToHex(currentBack).toLowerCase();
                if (hex !== '#ffffff' && hex !== '#000000' && hex !== 'transparent' && hex !== '') {
                    this.highlightBar.style.backgroundColor = hex;
                    this.currentHighlightColor = hex;
                } else if (sel && !sel.isCollapsed) {
                    this.currentHighlightColor = "#ffffff";
                    this.highlightBar.style.backgroundColor = hex;
                }
            }
            if (currentFore) {
                const hex0 = this.colorToHex(currentFore).toLowerCase();
                this.foreColorBar.style.backgroundColor = hex0;
                this.fontColorInput.value = hex0;
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
        const toHex = v => ('0' + parseInt(v, 10).toString(16)).slice(-2);
        return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
    }
    /**
     * @method saveAll
     * @description Saves the (clean) editor content to localStorage if enabled, with error handling for quota exceeded.
     */
    saveAll() {
        if (this.useLocalStorage) {
            const content = this.getCleanHTML();
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

    // =====================================================================
    //  RESIZING (images / tables)
    // =====================================================================

    /**
     * @method addResizeHandle
     * @description Adds the resize handle to a resizable element (image or table container). A floating figure
     * (a draggable image or handwriting drawing) also gets a rotate handle above it.
     */
    addResizeHandle(div) {
        const handles = div.querySelectorAll('.resize-handle, .rotate-handle, .rotate-handle-stem');
        handles.forEach(h => h.remove());
        div.classList.add('selected');
        if (div.classList.contains('floating')) {
            const rotate = document.createElement('div');
            rotate.className = 'rotate-handle';
            rotate.title = this.i18n.rotate;
            // Inline styling (not a stylesheet rule): a floating figure can be dropped into any host page, which
            // will not already have a look defined for a brand-new handle like this one.
            rotate.style.cssText = 'position:absolute; top:-28px; left:50%; width:16px; height:16px; margin-left:-8px;' +
                'background:#2563eb; border:2px solid #fff; border-radius:50%; box-shadow:0 1px 3px rgba(0,0,0,.4);' +
                'cursor:grab; z-index:7;';
            const stem = document.createElement('div');
            stem.className = 'rotate-handle-stem';
            stem.style.cssText = 'position:absolute; top:-14px; left:50%; width:2px; height:14px; margin-left:-1px; background:#2563eb; z-index:6; pointer-events:none;';
            div.appendChild(stem);
            div.appendChild(rotate);
        }
        if (div.classList.contains('full')) return;
        if (div.querySelector('table')) return;
        const handle = document.createElement('div');
        handle.className = 'resize-handle se';
        div.appendChild(handle);
    }
    /**
     * @method removeResizeHandles
     * @description Removes the resize (and, for a floating figure, rotate) handle from a resizable element.
     */
    removeResizeHandles(div) {
        const handles = div.querySelectorAll('.resize-handle, .rotate-handle, .rotate-handle-stem');
        handles.forEach(h => h.remove());
        div.classList.remove('selected');
    }
    /** Widest a figure may become: the text width of the page it sits on - or, for a floating figure (which never
     * gets the --jc-ml / --jc-mr custom properties those read, since it takes no part in that flow-based layout
     * at all), however much room is left between its own current left edge and the page's right edge. Without
     * this, a floating figure could be resized far wider than actually fits, and dragging it back afterward would
     * look like it was being pushed back "inside" only on a second try. */
    _maxFigureWidth(fig) {
        if (fig.classList.contains('floating')) {
            const root = fig.closest('#editor') || this.editor;
            const left = parseFloat(fig.style.left) || 0;
            return Math.max(50, root.clientWidth - left);
        }
        const cs = getComputedStyle(fig);
        const ml = parseFloat(cs.getPropertyValue('--jc-ml')) || 0;
        const mr = parseFloat(cs.getPropertyValue('--jc-mr')) || 0;
        const side = fig.classList.contains('center') ? 2 * Math.max(ml, mr) : ml + mr;
        const root = fig.closest('#editor') || this.editor;
        return Math.max(50, root.clientWidth - side);
    }
    /** Shared start of a mouse / touch resize. */
    _beginResize(handle, clientX) {
        this.currentResizable = handle.parentElement;
        this.resizeOldContent = this.snapshot();
        const table = this.currentResizable.querySelector('table');
        const img = this.currentResizable.querySelector('img');
        this.startWidth = this.currentResizable.offsetWidth;
        this.minWidth = table ? table.rows[0].cells.length * 70 : 50;
        this.aspectRatio = img ? img.naturalWidth / img.naturalHeight : null;
        this.startX = clientX;
        this.isResizing = true;
    }
    /** Shared width update of a mouse / touch resize. */
    _doResize(clientX) {
        const deltaX = clientX - this.startX;
        let newWidth = this.startWidth + deltaX;
        newWidth = Math.max(this.minWidth, Math.min(newWidth, this._maxFigureWidth(this.currentResizable)));
        this.currentResizable.style.width = `${newWidth}px`;
        if (this.aspectRatio) {
            this.currentResizable.style.height = `${newWidth / this.aspectRatio + 25}px`;
        } else {
            this.currentResizable.style.height = 'auto';
        }
        const table = this.currentResizable.querySelector('table');
        if (table) table.style.width = '100%';
        if (this.currentResizable.classList.contains('floating')) {
            // smoothly, on every step of the resize (not just once it is released): it stays free to grow into a
            // margin, real content and all, and is only ever stopped by the sheet's own edge, same as while
            // dragging or rotating it.
            this._keepFloatingInBounds(this.currentResizable, false, true);
            this._keepFloatingInBounds(this.currentResizable, false, false);
        }
    }
    /** Shared end of a mouse / touch resize (records ONE undo step). */
    _endResize() {
        this.isResizing = false;
        if (this.currentResizable && this.currentResizable.classList.contains('floating')) {
            // a final safety net, matching the same check applied on every move: nothing - real content or a
            // rotated shape's transparent overhang alike - ever ends up past the sheet's own edge.
            this._keepFloatingInBounds(this.currentResizable, false, true);
            this._keepFloatingInBounds(this.currentResizable, false, false);
        }
        if (this.snapshot() !== this.resizeOldContent) {
            this.undoStack.push(this.resizeOldContent);
            this.undoStack = this.undoStack.slice(-50);
            this.redoStack = [];
            this.lastContent = this.snapshot();
            this.saveAll();
        }
    }
    /** Shared start of a mouse / touch drag of a floating (handwriting) figure. */
    _beginDrag(figure, clientX, clientY) {
        this.dragFigure = figure;
        this.dragOldContent = this.snapshot();
        this.dragStartLeft = parseFloat(figure.style.left) || 0;
        this.dragStartTop = parseFloat(figure.style.top) || 0;
        this.dragStartX = clientX;
        this.dragStartY = clientY;
        this.isDragging = true;
    }
    /** Shared move of a drag: the figure is free to sit anywhere on the page it is over, real content and all -
     * margins included - and is only ever stopped by that sheet's own edges and the gap before/after it. A
     * rotated figure's real content is measured by its own true box, not the larger one its corners reach into
     * while turned, so that box (not the inflated one) is what has to stay on the page. */
    _doDrag(clientX, clientY) {
        const fig = this.dragFigure;
        const maxLeft = Math.max(0, this.editor.clientWidth - fig.offsetWidth);
        const left = Math.min(maxLeft, Math.max(0, this.dragStartLeft + (clientX - this.dragStartX)));
        const top = Math.max(0, this.dragStartTop + (clientY - this.dragStartY));
        fig.style.left = `${Math.round(left)}px`;
        fig.style.top = `${Math.round(top)}px`;
        this._keepFloatingInBounds(fig, false, true);    // real content is free to enter a margin, not to leave the sheet
        this._keepFloatingInBounds(fig, false, false);   // ...and neither is a rotated shape's transparent overhang
    }
    /** Shared end of a drag (records ONE undo step, like a resize). */
    _endDrag() {
        this.isDragging = false;
        if (this.snapshot() !== this.dragOldContent) {
            this.undoStack.push(this.dragOldContent);
            this.undoStack = this.undoStack.slice(-50);
            this.redoStack = [];
            this.lastContent = this.snapshot();
            this.saveAll();
        }
        this.dragFigure = null;
    }
    /** Shared start of a mouse / touch rotation of a floating figure's rotate handle. */
    _beginRotate(figure, clientX, clientY) {
        this.rotateFigure = figure;
        this.rotateOldContent = this.snapshot();
        const r = figure.getBoundingClientRect();
        this.rotateCenterX = r.left + r.width / 2;
        this.rotateCenterY = r.top + r.height / 2;
        const m = /rotate\(([-\d.]+)deg\)/.exec(figure.style.transform || '');
        this.rotateStart = m ? parseFloat(m[1]) : 0;
        const startAngle = Math.atan2(clientY - this.rotateCenterY, clientX - this.rotateCenterX) * 180 / Math.PI;
        this.rotatePointerOffset = startAngle - this.rotateStart;
        this.isRotating = true;
    }
    /** Shared move of a rotation: the figure turns to keep facing the pointer, snapping to 15° when held near one. */
    _doRotate(clientX, clientY) {
        const angle = Math.atan2(clientY - this.rotateCenterY, clientX - this.rotateCenterX) * 180 / Math.PI;
        let deg = angle - this.rotatePointerOffset;
        const nearest15 = Math.round(deg / 15) * 15;
        if (Math.abs(deg - nearest15) < 3) deg = nearest15;
        this.rotateFigure.style.transform = `rotate(${deg.toFixed(1)}deg)`;
        this.rotateFigure.dataset.rotate = deg.toFixed(1);
        // Turning a figure can push it partway off the sheet even though it never moved - nudge it back so its
        // real content (measured by its own true box, not the larger one its corners now reach into) stays free
        // to sit anywhere on the page, margins included, but never off the sheet itself.
        this._keepFloatingInBounds(this.rotateFigure, false, true);
        this._keepFloatingInBounds(this.rotateFigure, false, false);
    }
    /**
     * @method _keepFloatingInBounds
     * @description Slides a floating figure - never resizing or un-rotating it - just enough that it never crosses
     * the given boundary. useMargins=true keeps it inside that page's margins (used while rotating: turning a
     * figure can suddenly push its corners past a margin it already fit inside); useMargins=false keeps it
     * anywhere on that full sheet, margins included, but never off the sheet itself or into the gap before/after
     * it (used while dragging). tightFootprint=true measures the figure's own real box rather than the larger one
     * a rotated shape's corners reach into, so a diagonal image dragged to a margin can tuck its actual content
     * right up against it, with only the empty, transparent corners its rotation leaves behind allowed past it -
     * that real box is measured with the figure's width and height SWAPPED once the rotation passes 45°, since a
     * shape turned close to 90° really does stand taller than it is wide (a long, low image turned upright is
     * genuinely a tall, narrow one; keeping the original, un-rotated width and height at that angle would measure
     * a box far shorter than the actual content and let real image sit past a margin undetected).
     */
    _keepFloatingInBounds(figure, useMargins, tightFootprint) {
        const MM = jCaret.MM, P = jCaret.PAGE_H * MM, S = P + jCaret.PAGE_GAP;
        const editorRect = this.editor.getBoundingClientRect();
        const rect = figure.getBoundingClientRect();   // already reflects the current rotation
        let boxLeft, boxTop, boxRight, boxBottom;
        if (tightFootprint) {
            const cx = rect.left - editorRect.left + rect.width / 2, cy = rect.top - editorRect.top + rect.height / 2;
            // normalize the rotation to how far past the nearest "upright" orientation (0°/180° vs 90°/270°) it
            // is: past the 45° halfway point, the figure's real width and height have effectively traded places
            const deg = Math.abs(parseFloat(figure.dataset.rotate) || 0) % 180;
            const swapped = deg > 45 && deg < 135;
            const halfW = (swapped ? figure.offsetHeight : figure.offsetWidth) / 2;
            const halfH = (swapped ? figure.offsetWidth : figure.offsetHeight) / 2;
            boxLeft = cx - halfW; boxRight = cx + halfW; boxTop = cy - halfH; boxBottom = cy + halfH;
        } else {
            boxLeft = rect.left - editorRect.left; boxTop = rect.top - editorRect.top;
            boxRight = rect.right - editorRect.left; boxBottom = rect.bottom - editorRect.top;
        }
        const curTop = parseFloat(figure.style.top) || 0;
        const totalPages = this._totalPages || 1;
        const k = Math.max(0, Math.min(totalPages - 1, Math.floor((curTop + rect.height / 2) / S)));
        let pageLeft, pageRight, pageTop, pageBottom;
        if (useMargins) {
            const m = this.getPageMargins(k);
            pageLeft = m.left * MM; pageRight = this.editor.clientWidth - m.right * MM;
            pageTop = k * S + m.top * MM; pageBottom = k * S + P - m.bottom * MM;
        } else {
            pageLeft = 0; pageRight = this.editor.clientWidth;
            pageTop = k * S; pageBottom = k * S + P;
        }
        let dx = 0, dy = 0;
        if (boxLeft < pageLeft) dx = pageLeft - boxLeft;
        else if (boxRight > pageRight) dx = pageRight - boxRight;
        if (boxTop < pageTop) dy = pageTop - boxTop;
        else if (boxBottom > pageBottom) dy = pageBottom - boxBottom;
        if (dx || dy) {
            figure.style.left = `${Math.round((parseFloat(figure.style.left) || 0) + dx)}px`;

            figure.style.top = `${Math.round(curTop + dy)}px`;
        }
    }
    /** Shared end of a rotation (records ONE undo step, like a drag or a resize). */
    _endRotate() {
        this.isRotating = false;
        if (this.snapshot() !== this.rotateOldContent) {
            this.undoStack.push(this.rotateOldContent);
            this.undoStack = this.undoStack.slice(-50);
            this.redoStack = [];
            this.lastContent = this.snapshot();
            this.saveAll();
        }
        this.rotateFigure = null;
    }
    /**
     * @method onMouseDown
     * @description Initiates the resizing process on mouse down.
     */
    onMouseDown(e) {
        if (e.target.classList && e.target.classList.contains('resize-handle')) {
            e.preventDefault();
            this._beginResize(e.target, e.clientX);
            document.addEventListener('mousemove', this._boundMouseMove);
            document.addEventListener('mouseup', this._boundMouseUp);
            return;
        }
        if (e.target.classList && e.target.classList.contains('rotate-handle')) {
            e.preventDefault();
            this._beginRotate(e.target.parentElement, e.clientX, e.clientY);
            document.addEventListener('mousemove', this._boundMouseMove);
            document.addEventListener('mouseup', this._boundMouseUp);
            return;
        }
        const floating = e.target.closest && e.target.closest('.resizable.floating');
        if (floating) {
            e.preventDefault();
            this._beginDrag(floating, e.clientX, e.clientY);
            document.addEventListener('mousemove', this._boundMouseMove);
            document.addEventListener('mouseup', this._boundMouseUp);
        }
    }
    /**
     * @method onTouchStart
     * @description Initiates the resizing process on touch start.
     */
    onTouchStart(e) {
        if (e.target.classList && e.target.classList.contains('resize-handle')) {
            e.preventDefault();
            this._beginResize(e.target, e.touches[0].clientX);
            document.addEventListener('touchmove', this._boundTouchMove, { passive: false });
            document.addEventListener('touchend', this._boundTouchEnd);
            return;
        }
        if (e.target.classList && e.target.classList.contains('rotate-handle')) {
            e.preventDefault();
            this._beginRotate(e.target.parentElement, e.touches[0].clientX, e.touches[0].clientY);
            document.addEventListener('touchmove', this._boundTouchMove, { passive: false });
            document.addEventListener('touchend', this._boundTouchEnd);
            return;
        }
        const floating = e.target.closest && e.target.closest('.resizable.floating');
        if (floating) {
            e.preventDefault();
            this._beginDrag(floating, e.touches[0].clientX, e.touches[0].clientY);
            document.addEventListener('touchmove', this._boundTouchMove, { passive: false });
            document.addEventListener('touchend', this._boundTouchEnd);
        }
    }
    /**
     * @method onMouseMove
     * @description Handles element resizing when the mouse moves.
     */
    onMouseMove(e) {
        if (this.isDragging) { e.preventDefault(); this._doDrag(e.clientX, e.clientY); return; }
        if (this.isRotating) { e.preventDefault(); this._doRotate(e.clientX, e.clientY); return; }
        if (!this.isResizing) return;
        e.preventDefault();
        this._doResize(e.clientX);
    }
    /**
     * @method onTouchMove
     * @description Handles element resizing when a touch moves.
     */
    onTouchMove(e) {
        if (this.isDragging) { e.preventDefault(); this._doDrag(e.touches[0].clientX, e.touches[0].clientY); return; }
        if (this.isRotating) { e.preventDefault(); this._doRotate(e.touches[0].clientX, e.touches[0].clientY); return; }
        if (!this.isResizing) return;
        e.preventDefault();
        this._doResize(e.touches[0].clientX);
    }
    /**
     * @method onMouseUp
     * @description Ends the resizing process on mouse up.
     */
    onMouseUp() {
        document.removeEventListener('mousemove', this._boundMouseMove);
        document.removeEventListener('mouseup', this._boundMouseUp);
        if (this.isDragging) this._endDrag();
        if (this.isRotating) this._endRotate();
        if (this.isResizing) this._endResize();
    }
    /**
     * @method onTouchEnd
     * @description Ends the resizing process on touch end.
     */
    onTouchEnd() {
        document.removeEventListener('touchmove', this._boundTouchMove);
        document.removeEventListener('touchend', this._boundTouchEnd);
        if (this.isDragging) this._endDrag();
        if (this.isRotating) this._endRotate();
        if (this.isResizing) this._endResize();
    }
}
