/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Node, Parser } from "commonmark";
import { Mappings } from "../ref/source-map";
import { DataHandleRead, DataStoreView } from "../data-store/data-store";

export async function Parse(hConfigFile: DataHandleRead, intermediateScope: DataStoreView): Promise<{ data: DataHandleRead, codeBlock: Node }[]> {
  const result: { data: DataHandleRead, codeBlock: Node }[] = [];
  const rawMarkdown = hConfigFile.ReadData();
  for (const codeBlock of ParseCodeblocks(rawMarkdown)) {
    const codeBlockKey = `codeBlock_${codeBlock.sourcepos[0][0]}`;

    const data = codeBlock.literal || "";
    const mappings = GetSourceMapForCodeBlock(hConfigFile.key, codeBlock);

    const hwCodeBlock = await intermediateScope.Write(codeBlockKey);
    const hCodeBlock = await hwCodeBlock.WriteData(data, mappings, [hConfigFile]);
    result.push({
      data: hCodeBlock,
      codeBlock: codeBlock
    });
  }
  return result;
}

function GetSourceMapForCodeBlock(sourceFileName: string, codeBlock: Node): Mappings {
  const result: Mappings = [];
  const numLines = codeBlock.sourcepos[1][0] - codeBlock.sourcepos[0][0] + (codeBlock.info === null ? 1 : -1);
  for (var i = 0; i < numLines; ++i) {
    result.push({
      generated: {
        line: i + 1,
        column: 0
      },
      original: {
        line: i + codeBlock.sourcepos[0][0] + (codeBlock.info === null ? 0 : 1),
        column: codeBlock.sourcepos[0][1] - 1
      },
      source: sourceFileName,
      name: `Codeblock line '${i + 1}'`
    });
  }
  return result;
}

export function ParseCommonmark(markdown: string): Node {
  return new Parser().parse(markdown);
}

function* ParseCodeblocks(markdown: string): Iterable<Node> {
  const parsed = ParseCommonmark(markdown);
  const walker = parsed.walker();
  let event;
  while ((event = walker.next())) {
    var node = event.node;
    if (event.entering && node.type === "code_block") {
      yield node;
    }
  }
}




const commonmarkHeadingNodeType = "heading";
const commonmarkHeadingMaxLevel = 1000;

function CommonmarkParentHeading(startNode: Node): Node | null {
  const currentLevel = startNode.type === commonmarkHeadingNodeType
    ? startNode.level
    : commonmarkHeadingMaxLevel;

  let resultNode: Node | null = startNode;
  while (resultNode != null && (resultNode.type !== commonmarkHeadingNodeType || resultNode.level >= currentLevel)) {
    resultNode = resultNode.prev || resultNode.parent;
  }

  return resultNode;
}

export function* CommonmarkSubHeadings(startNode: Node | null): Iterable<Node> {
  if (startNode && (startNode.type === commonmarkHeadingNodeType || !startNode.prev)) {
    const currentLevel = startNode.level;
    let maxLevel = commonmarkHeadingMaxLevel;

    startNode = startNode.next;
    while (startNode != null) {
      if (startNode.type === commonmarkHeadingNodeType) {
        if (currentLevel < startNode.level) {
          if (startNode.level <= maxLevel) {
            maxLevel = startNode.level;
            yield startNode;
          }
        } else {
          break;
        }
      }
      startNode = startNode.next;
    }
  }
}

export function CommonmarkHeadingText(headingNode: Node): string {
  let text = "";
  let node = headingNode.firstChild;
  while (node) {
    text += node.literal;
    node = node.next;
  }
  return text;
}

export function CommonmarkHeadingFollowingText(headingNode: Node): [number, number] {
  let subNode = headingNode.next;
  if (subNode === null) { throw new Error("No node found after heading node"); }
  const startPos = subNode.sourcepos[0];
  while (subNode.next
    && subNode.next.type !== "code_block"
    && (subNode.next.type !== commonmarkHeadingNodeType /* || subNode.next.level > headingNode.level*/)) {
    subNode = subNode.next;
  }
  const endPos = subNode.sourcepos[1];

  return [startPos[0], endPos[0]];
}