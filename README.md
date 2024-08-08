# LiveEditor

Welcome to the official LiaScript collaborative LiveEditor! This advanced editor runs entirely in your browser, offering unique capabilities beyond typical markdown editors.

https://github.com/user-attachments/assets/20e40c28-88b9-4aa8-b50d-cb776ad8707a

Try it out: [LiaScript LiveEditor](https://liascript.github.io/LiveEditor/)

For more information about LiaScript, visit the LiaScript website:

https://liascript.github.io

or checkout our YouTube-Channel:

https://www.youtube.com/@liascript4180

## Why Choose LiveEditor?

Unlike conventional markdown editors like [HedgeDoc](https://hedgedoc.org), [HackMD](https://hackmd.io), or [Typora](https://typora.io/), LiveEditor operates fully in-browser and can also be installed and used offline, since it is a Progressive Web App too. Thus, when you upload images, videos, or audio files, they remain stored within your browser. If you switch to online editing mode, you can synchronize your work with peers using [WebRTC].

LiveEditor is specifically designed for creating LiaScript content, enabling you to make your content interactive and engaging.

## LiaScript Features

LiaScript is a markdown language that extends the capabilities of traditional markdown. It allows you to create interactive content with features like:

- Quizzes
- Surveys
- Animations
- Text-to-speech output
- Live coding
- Offline support
- Extensive plugin support and customizability

  See therefore: https://github.com/topics/liascript-template

## LiveEditor Features

https://github.com/user-attachments/assets/63494d0f-4885-4fd1-8a07-926797c41b42

LiveEditor offers a range of features to enhance your content creation experience:

- **Collaborative Editing**: Work together with peers in real-time.
- **WebRTC Synchronization**: Sync your work seamlessly with others.
- **Instant Preview**: Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to see your changes immediately.
- **Media Uploads**: Easily upload images, videos, and audio files.
- **In-Browser Recording**: Record audio and video directly in the browser.
- **Export Options**: Export your courses to GitHub gists or data URIs.
- **Download Options**: Download your course as a ZIP file or Markdown only.
- **External Document Preview**: Preview documents from external sources.
- **Sharing**: Share your editor via snapshot URLs, external resources, or embed codes.
  in this case the entire code of your document will be embedded in the URL.
- **Editor enhances**: The editor is enhanced with a lot of features

  - Automated table formatting by pressing <kbd>Tab</kbd>
  - Short-cuts by starting typing `lia`
  - MathJS included, which allows you to perform calculations within the browser or translate between different units
  - Emoji support start typing `:`

Experience a new level of interactive content creation with LiaScript's LiveEditor!

## Building the project locally

If you want to run this editor by your own, you need to have installed node with npm.
For more information, check out the following link:

https://nodejs.org/en

Then simply clone this repository and run the following commands:

```bash
git clone https://github.com/liaScript/liveeditor

cd liveeditor

npm install

# start the development server
npm run watch

# build the project into the dist folder
npm run build
```

In for enabling all features, you will need to have a `.env` file in the root directory of this project, with the following content:

```ini
# A text-to-speech javascript engine, if tts is not supported by the browser
RESPONSIVEVOICE_KEY="YOUR RESPONSIVEVOICE_KEY"
# Add a proxy if external resource-links of external documents are blocked by CORS
PROXY="https://api.allorigins.win/get?url="
# Add your own GitHub client id and secret, if you want to enable the GitHub export
GITHUB_CLIENT_ID="xxxxxxx"
GITHUB_CLIENT_SECRET="xxxxxx"
# Add an WebRTC signaling server, if you want to enable the WebRTC synchronization
SIGNALING_SERVER="wss://..."
# Add an TURN/STUN server for WebRTC as a fallback, if direct connections are not possible
ICE_SERVERS='[{"urls":"stun:...."},{"urls":"turn:...","username":"...","credential":"...}, ...]'
# Add an Websocket-server for synchronization
WEBSOCKET_SERVER="wss://..."
```
