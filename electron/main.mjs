import {
	app,
	BrowserWindow,
	nativeTheme,
	safeStorage,
	session,
	shell,
	systemPreferences,
} from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let server;

/** Windows and Linux draw their controls over the page, so they need the page's colours. */
function titleBarOverlay() {
	return nativeTheme.shouldUseDarkColors
		? { color: "#1f2030", symbolColor: "#a3a5c0", height: 52 }
		: { color: "#f6f6f9", symbolColor: "#5e6078", height: 52 };
}

async function createWindow() {
	const isMac = process.platform === "darwin";
	const window = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 520,
		minHeight: 480,
		title: "ai-learn",
		backgroundColor: nativeTheme.shouldUseDarkColors ? "#1f2030" : "#f6f6f9",
		titleBarStyle: "hidden",
		...(isMac ? { trafficLightPosition: { x: 2, y: 16 } } : { titleBarOverlay: titleBarOverlay() }),
		webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
	});
	if (!isMac) {
		const onThemeChange = () => window.setTitleBarOverlay(titleBarOverlay());
		nativeTheme.on("updated", onThemeChange);
		window.once("closed", () => nativeTheme.off("updated", onThemeChange));
	}
	const origin = `http://127.0.0.1:${server.port}`;

	// Stay on the app's own page. Ordinary web links open in the system browser.
	window.webContents.setWindowOpenHandler(({ url }) => {
		if (/^https?:\/\//.test(url)) void shell.openExternal(url);
		return { action: "deny" };
	});
	window.webContents.on("will-navigate", (event, url) => {
		if (!url.startsWith(origin)) event.preventDefault();
	});
	await window.loadURL(`${origin}/#token=${server.token}`);
}

/** Only the app's own page may record, and only sound. Everything else stays denied. */
function isMicrophoneOnly(permission, url, mediaTypes) {
	const origin = server && `http://127.0.0.1:${server.port}`;
	const fromApp = origin !== undefined && (url === origin || url.startsWith(`${origin}/`));
	const audioOnly = mediaTypes?.length > 0 && mediaTypes.every((type) => type === "audio");
	return permission === "media" && fromApp && audioOnly;
}

/** macOS asks the learner once. Other systems don't gate the microphone per app. */
async function microphoneAllowed() {
	if (process.platform !== "darwin") return true;
	if (systemPreferences.getMediaAccessStatus("microphone") === "granted") return true;
	return systemPreferences.askForMediaAccess("microphone");
}

function allowMicrophoneOnly() {
	session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
		if (!isMicrophoneOnly(permission, details.requestingUrl, details.mediaTypes))
			return callback(false);
		microphoneAllowed().then(callback, () => callback(false));
	});
}

const NO_KEYCHAIN =
	"This computer has no keychain to encrypt keys with, so they can't be saved. Add them to .env.local instead.";

/** Saved API keys are encrypted with the system keychain. Without real encryption, none are saved. */
const keyCipher = {
	unavailableReason() {
		if (!safeStorage.isEncryptionAvailable()) return NO_KEYCHAIN;
		const plainText =
			process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text";
		return plainText ? NO_KEYCHAIN : undefined;
	},
	encrypt: (text) => safeStorage.encryptString(text),
	decrypt: (data) => safeStorage.decryptString(data),
};

if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on("second-instance", () => {
		const [window] = BrowserWindow.getAllWindows();
		if (window) {
			if (window.isMinimized()) window.restore();
			window.focus();
		}
	});
	app.whenReady().then(async () => {
		allowMicrophoneOnly();
		const envFile = join(root, ".env.local");
		if (existsSync(envFile)) process.loadEnvFile(envFile);
		const { startServer } = await import("../dist/server/index.mjs");
		server = await startServer({
			dataDir: app.getPath("userData"),
			webRoot: join(root, "dist/web"),
			keyCipher,
		});
		await createWindow();
		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) void createWindow();
		});
	});
	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") app.quit();
	});
	app.on("before-quit", () => void server?.close());
}
