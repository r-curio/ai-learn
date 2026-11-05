import { app, BrowserWindow, nativeTheme, session, shell } from "electron";
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
		session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
			callback(false),
		);
		const envFile = join(root, ".env.local");
		if (existsSync(envFile)) process.loadEnvFile(envFile);
		const { startServer } = await import("../dist/server/index.mjs");
		server = await startServer({
			dataDir: app.getPath("userData"),
			webRoot: join(root, "dist/web"),
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
