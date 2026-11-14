import Foundation
import AppKit
import Darwin

let app = NSApplication.shared
app.setActivationPolicy(.regular)
guard CommandLine.arguments.count == 2 else { exit(2) }
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let window = NSWindow(contentRect: NSRect(x:0,y:0,width:480,height:230), styleMask:[.titled,.closable], backing:.buffered, defer:false)
window.title = "Muzcast · Connexion TV"
window.isReleasedWhenClosed = false
let label = NSTextField(wrappingLabelWithString:"Connexion à votre téléviseur…\n\nUne demande macOS peut apparaître si l’accès au réseau local n’a pas encore été autorisé.")
label.frame = NSRect(x:24,y:72,width:432,height:135)
let settingsButton = NSButton(title:"Ouvrir les réglages réseau", target:nil, action:nil)
settingsButton.frame = NSRect(x:24,y:20,width:260,height:32)
settingsButton.bezelStyle = .rounded
settingsButton.isHidden = true
window.contentView?.addSubview(settingsButton)
window.contentView?.addSubview(label)
let python = Process()
python.executableURL = Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/python-relay/python-relay")
python.arguments = [directory.path]
// The interpreter and original relay are bundled. No shell, Terminal or system Python.
python.standardOutput = FileHandle.nullDevice
python.standardError = FileHandle.nullDevice
python.terminationHandler = { _ in DispatchQueue.main.async { app.terminate(nil) } }
final class RelayDelegate: NSObject, NSApplicationDelegate {
    var launch: (() -> Void)?
    var stop: (() -> Void)?
    @objc func openNetworkSettings() {
        guard let url = URL(string:"x-apple.systempreferences:com.apple.preference.security?Privacy_LocalNetwork") else { return }
        NSWorkspace.shared.open(url)
    }
    // orderOut can invoke this callback too (observed on macOS 27). The TCP
    // session, not its progress window, owns this process: hiding it must never
    // terminate Python while the user is authorizing ADB on the TV.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationDidFinishLaunching(_ notification: Notification) { launch?() }
    func applicationWillTerminate(_ notification: Notification) { stop?() }
}
let browser = NetServiceBrowser()
let delegate = RelayDelegate()
settingsButton.target = delegate
settingsButton.action = #selector(RelayDelegate.openNetworkSettings)
delegate.launch = {
    window.center()
    window.makeKeyAndOrderFront(nil)
    app.activate(ignoringOtherApps:true)
    browser.searchForServices(ofType:"_adb._tcp.", inDomain:"local.")
    do { try python.run() } catch { app.terminate(nil) }
}
delegate.stop = { browser.stop(); if python.isRunning { python.terminate() } }
app.delegate = delegate
let timer = Timer.scheduledTimer(withTimeInterval:0.25,repeats:true) { _ in
    if FileManager.default.fileExists(atPath:directory.appendingPathComponent("stop").path) {
        app.terminate(nil)
    }
    if let data = try? Data(contentsOf:directory.appendingPathComponent("status.json")),
       let state = try? JSONSerialization.jsonObject(with:data) as? [String:Any],
       let _ = state["port"] {
        if state["connected"] as? Bool == true {
            window.orderOut(nil)
        } else if state["waiting"] as? Bool == true {
            settingsButton.isHidden = false
            label.stringValue = "La connexion au réseau local échoue.\n\nSi aucune demande n’apparaît, vérifiez Réglages Système → Confidentialité et sécurité → Réseau local → MuzcastNetwork. Vérifiez aussi que la TV est allumée."
        }
    }
}
app.run()
