import { Notice, Plugin } from "obsidian";
import { OmnidianSettingTab } from "@/settings";
import postprocessor from "@/preview/postprocessor"; // We'll rely on this to attach click handlers to .omnidian-highlight
import { showCommentPopoverAtCoords } from "@/editor/popover";
import "../manifest.json";

import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import type { Literal } from "unist";

let currentPopover: HTMLElement | null = null;

/**
 * Use a Markdown AST to find the exact offset of selected text in the file.
 */
async function findExactOffsetInMarkdown(markdown: string, selectedText: string): Promise<{ start: number; end: number } | null> {
  const tree = unified().use(remarkParse).parse(markdown);

  let match: { start: number; end: number } | null = null;

  visit(tree, "text", (node: Literal) => {
    if (!node.value || !node.position) return;

    const textValue = node.value as string;
    const index = textValue.indexOf(selectedText);
    if (index !== -1) {
      const nodeOffset = node.position.start.offset ?? 0;
      match = {
        start: nodeOffset + index,
        end: nodeOffset + index + selectedText.length,
      };
    }
  });

  return match;
}

export interface OmnidianSettings {
  expandSelection: boolean;
  colors: string[];
}

const DEFAULT_SETTINGS: OmnidianSettings = {
  expandSelection: true,
  colors: ["lightpink", "palegreen", "paleturquoise", "violet"],
};

export default class OmnidianPlugin extends Plugin {
  settings: OmnidianSettings = DEFAULT_SETTINGS;
  isHighlightingModeOn = false;
  statusBarItemEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    // Ribbon icon to toggle highlight mode
    this.addRibbonIcon(
      "highlighter",
      `${this.isHighlightingModeOn ? "Disable" : "Enable"} highlighting mode`,
      () => {
        this.toggleHighlightingMode();
      },
    );

    // Status bar item
    this.addStatusBarModeIndicator();

    // Settings tab
    this.addSettingTab(new OmnidianSettingTab(this.app, this));

    // Postprocessor for reading-mode highlight clicks
    this.registerMarkdownPostProcessor(postprocessor);

    // Close any open popover if user clicks outside it
    document.addEventListener("mousedown", (e) => {
      if (currentPopover && !currentPopover.contains(e.target as Node)) {
        currentPopover.remove();
        currentPopover = null;
      }
    });

    // Listen for highlight clicks (custom event)
    document.addEventListener("omnidian-show-popover", async (evt: Event) => {
      const { coords, text } = (evt as CustomEvent).detail;

      if (currentPopover) {
        currentPopover.remove();
        currentPopover = null;
      }

      const file = this.app.workspace.getActiveFile();
      if (!file) return;

      const rawText = await this.app.vault.read(file);

      // Check if there's an existing comment
      const match = rawText.match(new RegExp(`==${text}==(?:<!--(.*?)-->)?`));
      let foundComment = match?.[1]?.trim();
      let foundColor: string | undefined;
      if (foundComment) {
        const colorMatch = foundComment.match(/@([\w-]+)/);
        foundColor = colorMatch?.[1] ?? undefined;
        if (foundColor) {
          foundComment = foundComment.replace(`@${foundColor}`, "").trim();
        }
      }

      // Show popover
      const container = showCommentPopoverAtCoords(coords, text, {
        onSave: ({  }) => {
          // Handle save logic here
        },
      });

      currentPopover = container;
    });

    // Reading mode highlight
    this.registerDomEvent(document, "mouseup", this.handleReadingModeHighlight);
    this.registerDomEvent(document, "touchend", this.handleReadingModeHighlight);
  }

  handleReadingModeHighlight = async (e: MouseEvent | TouchEvent) => {
    if (!this.isHighlightingModeOn) return;

    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target || !target.closest(".markdown-preview-view,.markdown-reading-view")) {
      return;
    }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) return;

    const selectedText = domSelection.toString().trim();
    if (!selectedText) return;

    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("No active file found to highlight.");
      return;
    }

    let rawText = await this.app.vault.read(file);

    const match = await findExactOffsetInMarkdown(rawText, selectedText);
    let noticeMessage: string;
    if (!match) {
      rawText = `==${selectedText}==\n${rawText}`;
      noticeMessage = "Could not find the exact text; highlight inserted at top of file.";
    } else {
      const before = rawText.slice(0, match.start);
      const after = rawText.slice(match.end);
      rawText = `${before}==${selectedText}==${after}`;
      noticeMessage = `Highlighted text: "${selectedText}"`;
    }

    await this.app.vault.modify(file, rawText);
    await this.app.workspace.getLeaf().openFile(file, { state: { mode: "preview" } });
    new Notice(noticeMessage);

    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect) return;

    if (currentPopover) {
      currentPopover.remove();
      currentPopover = null;
    }

    const container = showCommentPopoverAtCoords(
      { x: rect.left + window.scrollX, y: rect.top + window.scrollY },
      selectedText,
      {
        onSave: async ({  }) => {
          container.remove();
          currentPopover = null;
        },
      }
    );
    currentPopover = container;
  };

  toggleHighlightingMode() {
    this.isHighlightingModeOn = !this.isHighlightingModeOn;
    this.statusBarItemEl?.setText(`Highlighting mode: ${this.isHighlightingModeOn}`);
    new Notice(
      `Highlighting mode ${this.isHighlightingModeOn ? "enabled" : "disabled"}`
    );
  }

  addStatusBarModeIndicator() {
    this.statusBarItemEl = this.addStatusBarItem();
    this.statusBarItemEl.setText(`Highlighting mode: ${this.isHighlightingModeOn}`);
    this.statusBarItemEl.addEventListener("click", () =>
      this.toggleHighlightingMode()
    );
  }

  onunload() {
    // any popover cleanup
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
