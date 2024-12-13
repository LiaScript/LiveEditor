export const tutorial = `<!--
author: André Dietrich
email:  LiaScript@web.de
comment: This is a short introduction to the LiaScript live editor.

classroom: disable
-->

# Welcome to LiaScript

If you are new to LiaScript and this editor then please read this short introduction ...
otherwise we are sorry for interrupting, please go on and create a beautiful course ;-)

> __Note:__
> 
> This is a new editor based on [Yjs](https://docs.yjs.dev) for collaborative.
> We are still in the development phase and some feature like directly sharing courses from this editor and uploading multimedia content does will not work.
> This editor is entirely browser-based, thus there is no backend involved which stores your content.
> Everything will be stored within your local browser and you should also be able to edit content offline.


<article>

---

### 1. Editing

If you are new to
[Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet),
check out some or our [resources](#resources), otherwise start typing ...
__WAIT__ ... the preview does not update, right?
This is not a bug!
The live update is deactivated to minimize computational costs and to stop errors from being show, when HTML, JavaScript is not fully written down.
You have to update the preview by your own, simply by clicking onto the compilation button at the top or, to speed up things, by pressing <kbd>Ctrl</kbd> + <kbd>S</kbd> on your keyboard.


| Shortcut                       | Action                   |
|--------------------------------|--------------------------|
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Update the preview       |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> | Open document search     |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | Select all               |
| <kbd>F1</kbd>                  | Open command line pallet |

---

### 2. Snippets

We added 3 types of snippets, that are indicated by \`lia\`, \`hili\`, and \`voice\`.
This way you do not have to remember all details but can simply search through the different options.
One way to start a document is by typing \`liainit\` and then hitting <kbd>Enter</kbd>.
This will generate a document stub for you, which you can use as a starting point.
_When you update the preview, this help will be gone._

You have to extend the snippets-view by clicking onto the arrow on the right.
This way, more information will be presented and you can start your experiments.

1. Start typing \`lia\` in your markdown document to see the extended help, that can be explored via fuzzy-searching.
   Hit <kbd>Tab</kbd> or <kbd>Enter</kbd> for inserting your selected snippet.

2. To ease the \`voice\` selection for different narrators, start typing voice and search through all possible voice settings.

3. Syntax highlighting help is offered if you start typing \`hili\` followed by your language of choice.
   Since LiaScript applies the ace-editor, there is a matching done between highlight.js and ace.
   You can select your language from highlight.js, but it will be translated into the text in parentheses.

---

### 3. Navigating

You can use the mouse to navigate between the editor and the preview.

1. __Preview --> Editor__:
   If you double-click on an element within the preview pane the cursor within the editor will automatically jump to the corresponding line.  

2. __Editor --> Preview__:
   Press <kbd>Ctrl</kbd> and double-click on a word with the editor, which will open the corresponding page within the preview.

</article>

## Collaborative editing

When you create a new document you are by default in "Offline" mode.
Currently you can choose between two collaboration modes, based on "[WebRTC](https://en.wikipedia.org/wiki/WebRTC)" (browser to browser) and the other on on a WebSocket using a server for mirroring all status updates.
If you are in collaboration mode and share this URL all of your edits and those of other users shall be synced, even if you switch to offline and later reunite with your other peers.
You can also edit your content entirely offline, all states will be stored in your browser.
Thus, if you want a course where no external user can change the content, you will have to keep the URL private or you can create a new private copy by clicking on "Fork" at the menu.
A "fork" will create a new starting point for your document that begins with the last state of your current doc.

## Sharing

### Snapshots

Within the "Menu" you have to possibility to share a "Snapshot-URL" of your document.
This means, the content of your current document will be zipped, encoded as [base64](https://en.wikipedia.org/wiki/Base64), and the resulting code will be attached to the URL.
The longer your document, the longer the resulting URL.
However, this is intended to share short examples, thus, you should check at first if the course can be displayed properly and if your messenger does not truncate some of the content.

The resulting document can be opened, edited, and also the new content can be shared, but it will not be stored permanently within your browser nor is collaborative editing possible.
You will have to fork the document at first, then your changes will be stored persistently and you can work on it with other creators. 

### Files

You can predefine an external resource as a starting point for sharing.
Insert the URL of the raw Markdown as if you would share a course and this file will be added as a URL-parameter to your share link.


## Multimedia

You can also upload and store multimedia-content (images, audio, video) to your browser ;-) ...
When uploading videos, you should use Chrome, the replay of local videos is somehow slow in Firefox.
Ff you need for example simple diagrams, you can use also the LiaScript ASCII-art features.

You can copy and paste the following example into your document:

\`\`\` markdown
                                    Multiline
      1.9 |
          |                 ***
        y |               *     *
        - | r r r r r r r*r r r r*r r r r r r r
        a |             *         *
        x |            *           *
        i | B B B B B * B B B B B B * B B B B B
        s |         *                 *
          | *  * *                       * *  *
       -1 +------------------------------------
          0              x-axis               1
\`\`\`


or ...

\`\`\`\`
\`\`\` ascii
+------+   +-----+   +-----+   +-----+
|      |   |     |   |     |   |     |
| Foo  +-->| Bar +---+ Baz |<--+ Moo |
|      |   |     |   |     |   |     |
+------+   +-----+   +--+--+   +-----+
              ^         |
              |         V
.-------------+-----------------------.
| Hello here and there and everywhere |
'-------------------------------------'
\`\`\`
\`\`\`\`

## Resources


* Project-Website: https://LiaScript.github.io

* Open-Source: https://github.com/liascript

* YouTube: https://www.youtube.com/channel/UCyiTe2GkW_u05HSdvUblGYg

* Additional resources:
  
  - Documentation: https://github.com/LiaScript/docs
  - Free books: https://github.com/LiaBooks
  - Templates: https://github.com/topics/liascript-template
  - Courses & ...: https://github.com/topics/liascript-course
  - Blog: https://liascript.github.io/blog

* Editor:

  - VSCode: https://code.visualstudio.com/Download

    - HowTo: https://liascript.github.io/blog/install-visual-studio-code-with-liascript
    - Liascript-Preview: https://marketplace.visualstudio.com/items?itemName=LiaScript.liascript-preview
    - Liascript-Snippets: https://marketplace.visualstudio.com/items?itemName=LiaScript.liascript-snippets

  - Atom: https://liascript.github.io/blog/install-atom-with-liascript

* Development-Server: https://www.npmjs.com/package/@liascript/devserver

* Exporter: https://www.npmjs.com/package/@liascript/exporter


## Get Help

How to contact us:

* by eMail: LiaScript@web.de
* via Twitter: https://twitter.com/LiaScript
* or via chat: https://gitter.im/LiaScript/community
`
