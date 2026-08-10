# ClearCut ✂️✨

ClearCut is a powerful, client-side web application that lets you instantly remove backgrounds from photos and automatically extract individual stickers from sticker sheets—all running locally in your browser!

### 👉 **[Use ClearCut Now!](https://BiaanVanSittert.github.io/ClearCut/)** 👈

## Features

- **Single Image Removal:** Drop any photo in, and ClearCut uses a local AI model to cleanly strip away the background without sending any of your data to an external server.
- **Sticker Pack Extractor:** Have a photo of a sticker sheet? ClearCut uses OpenCV to intelligently slice it up into individual stickers.
- **Advanced Editing:** Manually tweak results with a built-in single-stroke eraser, magic wand, and restore brush.
- **Undo/Redo Stack:** Make a mistake? Easily undo actions with `Ctrl+Z` or the on-screen controls.
- **Sticker Styling:** Add a classic white die-cut outline to your extracted stickers!
- **Local Auto-Saving:** Your session is instantly saved directly to your browser, so you never lose your edits.
- **Export Options:** Download your edited graphics as a ZIP of transparent PNGs or a neatly arranged single grid sheet.

## Privacy First

Because ClearCut relies on WebAssembly and client-side models, everything happens right on your device. Your photos are **never** uploaded to any servers. 

## Local Development

If you want to run the project locally or contribute:

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build
```

## Built With
- [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- [@imgly/background-removal](https://img.ly/docs/cesdk/ui/background-removal/)
- [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html)

---
*Created by [BiaanVanSittert](https://github.com/BiaanVanSittert)*
