import Foundation
import AppKit
import Darwin

let app = NSApplication.shared
app.setActivationPolicy(.regular)
guard CommandLine.arguments.count == 2 else { exit(2) }
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let window = NSWindow(contentRect: NSRect(x:0,y:0,width:440,height:150), styleMask:[.titled], backing:.buffered, defer:false)
window.title = "Muzcast · Connexion TV"
let label = NSTextField(wrappingLabelWithString:"Connexion à votre téléviseur…\n\nSi macOS demande l’accès au réseau local, autorisez Muzcast pour poursuivre.")
label.frame = NSRect(x:24,y:20,width:392,height:105)
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
    func applicationDidFinishLaunching(_ notification: Notification) { launch?() }
    func applicationWillTerminate(_ notification: Notification) { stop?() }
}
let browser = NetServiceBrowser()
let delegate = RelayDelegate()
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
       state["connected"] as? Bool == true { window.orderOut(nil) }
}
app.run()
