import { Point, ITextEditor, Range } from '@susisu/mte-kernel'
import { editor } from 'monaco-editor'

export default class TextEditorInterface extends ITextEditor {
  private textEditor: editor.IStandaloneCodeEditor

  constructor(textEditor) {
    super()
    this.textEditor = textEditor
  }

  getCursorPosition() {
    const position = this.textEditor.getPosition() || {
      lineNumber: 1,
      column: 1,
    }
    return new Point(position.lineNumber - 1, position.column - 1)
  }

  setCursorPosition(pos: Point) {
    this.textEditor.setPosition({
      lineNumber: pos.row + 1,
      column: pos.column + 1,
    })
  }

  setSelectionRange(range: Range) {
    this.textEditor.setSelection({
      startLineNumber: range.start.row + 1,
      startColumn: range.start.column + 1,
      endLineNumber: range.end.row + 1,
      endColumn: range.end.column + 1,
    })
  }

  getLastRow() {
    const model = this.textEditor.getModel()
    if (!model) {
      return 0
    }

    return model.getLineCount() - 1
  }

  acceptsTableEdit(row: number) {
    return true
  }

  getLine(row) {
    const model = this.textEditor.getModel()

    if (!model) {
      return ''
    }

    return model.getLineContent(row + 1)
  }

  insertLine(row: number, line: number) {
    this.textEditor.executeEdits('', [
      {
        range: {
          startLineNumber: row + 1,
          startColumn: 0,
          endLineNumber: row + 1,
          endColumn: 0,
        },
        text: line + '\n',
      },
    ])
  }

  deleteLine(row: number) {
    this.textEditor.executeEdits('', [
      {
        range: {
          startLineNumber: row + 1,
          startColumn: 0,
          endLineNumber: row + 2,
          endColumn: 0,
        },
        text: '',
      },
    ])
  }

  replaceLines(startRow: number, endRow: number, lines: string[]) {
    this.textEditor.executeEdits('', [
      {
        range: {
          startLineNumber: startRow + 1,
          startColumn: 0,
          endLineNumber: endRow + 2,
          endColumn: 0,
        },
        text: lines.join('\n') + '\n',
      },
    ])
  }

  transact(func: () => void): void {
    const model = this.textEditor.getModel()

    if (!model) {
      return
    }

    model.pushStackElement()
    func()
    model.pushStackElement()
  }

  destroy() {}
}
