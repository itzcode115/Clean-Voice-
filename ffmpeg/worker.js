import { CORE_URL, FFMessageType } from "./const.js";
import {
  ERROR_UNKNOWN_MESSAGE_TYPE,
  ERROR_NOT_LOADED,
  ERROR_IMPORT_FAILURE
} from "./errors.js";

let ffmpeg;

const load = async ({
  coreURL: _coreURL,
  wasmURL: _wasmURL,
  workerURL: _workerURL
}) => {
  const first = !ffmpeg;

  try {
    if (!_coreURL) {
      _coreURL =
        "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js";
    }

    importScripts(_coreURL);
  } catch {
    if (!_coreURL) {
      throw ERROR_IMPORT_FAILURE;
    }

    self.createFFmpegCore =
      (await import(_coreURL)).default;

    if (!self.createFFmpegCore) {
      throw ERROR_IMPORT_FAILURE;
    }
  }

  const coreURL = _coreURL;

  const wasmURL =
    _wasmURL ||
    coreURL.replace(/\.js$/g, ".wasm");

  const workerURL =
    _workerURL ||
    coreURL.replace(
      /\.js$/g,
      ".worker.js"
    );

  ffmpeg =
    await self.createFFmpegCore({
      mainScriptUrlOrBlob:
        `${coreURL}#${btoa(
          JSON.stringify({
            wasmURL,
            workerURL
          })
        )}`
    });

  ffmpeg.setLogger((data) => {
    self.postMessage({
      type: FFMessageType.LOG,
      data
    });
  });

  ffmpeg.setProgress((data) => {
    self.postMessage({
      type: FFMessageType.PROGRESS,
      data
    });
  });

  return first;
};

const exec = ({
  args,
  timeout = -1
}) => {
  ffmpeg.setTimeout(timeout);
  ffmpeg.exec(...args);

  const ret = ffmpeg.ret;

  ffmpeg.reset();

  return ret;
};

const writeFile = ({
  path,
  data
}) => {
  ffmpeg.FS.writeFile(path, data);
  return true;
};

const readFile = ({
  path,
  encoding
}) => {
  return ffmpeg.FS.readFile(
    path,
    { encoding }
  );
};

const deleteFile = ({
  path
}) => {
  ffmpeg.FS.unlink(path);
  return true;
};

self.onmessage = async ({
  data: {
    id,
    type,
    data: messageData
  }
}) => {

  let result;

  try {

    if (
      type !== FFMessageType.LOAD &&
      !ffmpeg
    ) {
      throw ERROR_NOT_LOADED;
    }

    switch (type) {

      case FFMessageType.LOAD:
        result =
          await load(messageData);
        break;

      case FFMessageType.EXEC:
        result =
          exec(messageData);
        break;

      case FFMessageType.WRITE_FILE:
        result =
          writeFile(messageData);
        break;

      case FFMessageType.READ_FILE:
        result =
          readFile(messageData);
        break;

      case FFMessageType.DELETE_FILE:
        result =
          deleteFile(messageData);
        break;

      default:
        throw ERROR_UNKNOWN_MESSAGE_TYPE;
    }

  } catch (e) {

    self.postMessage({
      id,
      type: FFMessageType.ERROR,
      data: String(e)
    });

    return;
  }

  self.postMessage({
    id,
    type,
    data: result
  });
};
