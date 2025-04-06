import type { MarkdownPostProcessorContext } from "obsidian";
import CommentRenderer from "./note";
import { matchColor } from "@/lib/utils";

interface HighlightMatch {
	fullMatch: string;
	highlightText: string;
	comment: string;
	line: number;
	ch: number;
}

/**
 * This postprocessor scans for ==text==<!--comment--> in the raw file,
 * then finds the corresponding <mark> elements in the preview. We color them,
 * attach a title, and attach a click handler that dispatches `omnidian-show-popover`
 * with the highlight text & coordinates so `main.ts` can open a popover.
 */
export default function postprocessor(
	element: HTMLElement,
	{ getSectionInfo, addChild }: MarkdownPostProcessorContext
) {
	const marks = element.findAll("mark");
	if (!marks.length) return;

	const section = getSectionInfo(element);
	if (!section) return;

	const unprocessedElement = section.text;
	const highlightRegex = /==(.*?)==(?:<!--(.*?)-->)?/g;
	const matches: HighlightMatch[] = [];

	let match;
	while ((match = highlightRegex.exec(unprocessedElement)) !== null) {
		const lines = unprocessedElement.slice(0, match.index).split("\n");
		const line = lines.length - 1;
		const ch = lines[lines.length - 1].length;

		matches.push({
			fullMatch: match[0],
			highlightText: match[1],
			comment: match[2],
			line,
			ch,
		});
	}

	let counter = 0;

	for (const mark of marks) {
		mark.addClass("omnidian-highlight");

		const matchIndex = matches.findIndex(
			(m) => m.highlightText === mark.innerText
		);
		if (matchIndex === -1) continue;

		const { comment, line, ch } = matches[matchIndex];
		matches.splice(matchIndex, 1); // remove it from the array

		const matchedColor = comment ? matchColor(comment) : undefined;
		const cleanComment = comment
			? comment.trim().replace(`@${matchedColor ?? ""}`, "").trim()
			: "";

		// if (!cleanComment) continue; // Removed to allow click handling for highlights without comments

		if (cleanComment) {
			mark.setAttribute("title", cleanComment);
			mark.addClass("has-comment");
		}

		element.addClass("relative");
		mark.setAttribute("data-line", line.toString());
		mark.setAttribute("data-ch", ch.toString());

		if (matchedColor) {
			mark.style.backgroundColor = matchedColor;
		}

		const finalColor = matchedColor ?? null;
		addChild(
			new CommentRenderer(
				element,
				cleanComment,
				counter % 2 ? "left" : "right",
				mark,
				finalColor
			)
		);
		counter++;

		mark.addEventListener("click", async (e) => {
			e.stopPropagation();

			const rect = mark.getBoundingClientRect();
			const event = new CustomEvent("omnidian-show-popover", {
				detail: {
					coords: {
						x: rect.left + window.scrollX,
						y: rect.top + window.scrollY,
					},
					text: mark.innerText,
					onSave: null, // Replace 'null' with the correct reference to the onSave function or property
				},
				bubbles: true,
			});

			mark.dispatchEvent(event);
		});
	}
}
