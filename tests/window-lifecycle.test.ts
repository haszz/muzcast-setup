import {expect,it,vi} from 'vitest'
import {revealWindow} from '../src/main/window-lifecycle'
it('recreates a closed window without touching destroyed Electron methods',()=>{
 const invalid=()=>{throw Error('Object has been destroyed')},create=vi.fn()
 expect(()=>revealWindow({isDestroyed:()=>true,isMinimized:invalid,restore:invalid,focus:invalid},create,true,false)).not.toThrow()
 expect(create).toHaveBeenCalledOnce()
})
it('restores a minimized existing window',()=>{
 const window={isDestroyed:()=>false,isMinimized:()=>true,restore:vi.fn(),focus:vi.fn()},create=vi.fn()
 revealWindow(window,create,true,false)
 expect(window.restore).toHaveBeenCalledOnce();expect(window.focus).toHaveBeenCalledOnce();expect(create).not.toHaveBeenCalled()
})
it.each([[false,false],[true,true]])('does not recreate a window before readiness or during quit', (ready,quitting)=>{
 const create=vi.fn();revealWindow(null,create,ready,quitting);expect(create).not.toHaveBeenCalled()
})
