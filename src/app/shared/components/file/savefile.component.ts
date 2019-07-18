import { Component, Input } from '@angular/core';
import { DownloadUtils } from './download.utils';
import * as circularJSON from 'circular-json';
import { FlowchartUtils } from '@models/flowchart';
import { DataService } from '@services';
import { InputType } from '@models/port';
import { ProcedureTypes, IProcedure } from '@models/procedure';
import { IdGenerator } from '@utils';
import { IMobius } from '@models/mobius';
import { INode } from '@models/node';

declare global {
    interface Navigator {
        webkitPersistentStorage: {
            requestQuota: (a, b, c) => {}
        };
    }
}

@Component({
    selector: 'file-save',
    template: `<button id='savefile' class='btn' (click)='download()'>Save</button>`,
    styles: [
        `
            button.btn{
                margin: 0px 0px 0px 0px;
                font-size: 10px;
                line-height: 12px;
                border: 2px solid gray;
                border-radius: 4px;
                padding: 2px 5px;
                background-color: #3F4651;
                color: #E7BF00;
                font-weight: 600;
                text-transform: uppercase;
             }
            button.btn:hover{
                background-color: gray;
                color: white;
            }
             `
    ]
})
export class SaveFileComponent {
    constructor(private dataService: DataService) {}

    static saveFileToLocal(f: IMobius) {
        const models = [];
        for (const node of f.flowchart.nodes) {
            const nodeModel = {
                'model': node.model,
                'input': node.input.value,
                'output': node.output.value
            };
            node.model = undefined;
            if (node.input.hasOwnProperty('value')) {
                node.input.value = undefined;
            }
            if (node.output.hasOwnProperty('value')) {
                node.output.value = undefined;
            }
            for (const prod of node.procedure) {
                if (prod.hasOwnProperty('resolvedValue')) {
                    prod.resolvedValue = undefined;
                }
            }
            models.push(nodeModel);
        }

        SaveFileComponent.saveToLocalStorage(f.flowchart.id, f.flowchart.name, circularJSON.stringify(f));

        for (const node of f.flowchart.nodes) {
            const mod = models.shift();
            node.model = mod.model;
            node.input.value = mod.input;
            node.output.value = mod.output;
        }
    }

    static saveToLocalStorage(id: string, name: string, file: string) {
        const itemstring = localStorage.getItem('mobius_backup_list');
        const code = name === '___TEMP___' ? name : name + '_-_' + id;
        if (!itemstring) {
            localStorage.setItem('mobius_backup_list', `["${code}"]`);
        } else {
            const items: string[] = JSON.parse(itemstring);
            let check = false;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item === code) {
                    items.splice(i, 1);
                    items.push(item);
                    check = true;
                    break;
                }
            }
            if (!check) {
                items.push(code);
                if (items.length > 5) {
                    const item = items.shift();
                    localStorage.removeItem(item);
                }
                localStorage.setItem('mobius_backup_list', JSON.stringify(items));
            }
        }
        const requestedBytes = 1024 * 1024 * 50;
        window['code'] = code;
        window['file'] = file;
        navigator.webkitPersistentStorage.requestQuota (
            requestedBytes, function(grantedBytes) {
                // @ts-ignore
                window.webkitRequestFileSystem(PERSISTENT, grantedBytes, SaveFileComponent.saveToFS,
                function(e) { console.log('Error', e); });
            }, function(e) { console.log('Error', e); }
        );

        // localStorage.setItem(code, file);
    }

    static saveToFS(fs) {
        fs.root.getFile(window['code'] + '.mob', { create: true}, function (fileEntry) {
            fileEntry.createWriter(function (fileWriter) {
                // fileWriter.onwriteend = function (e) {
                //     console.log('Write completed.');
                // };

                // fileWriter.onerror = function (e) {
                //     console.log('Write failed: ' + e.toString());
                // };
                const bb = new Blob([window['file']], {type: 'text/plain;charset=utf-8'});
                fileWriter.write(bb);
            }, (e) => { console.log(e); });
        }, (e) => { console.log(e.code); });
    }

    static deleteFile(filecode) {
        const requestedBytes = 1024 * 1024 * 50;
        navigator.webkitPersistentStorage.requestQuota (
            requestedBytes, function(grantedBytes) {
                // @ts-ignore
                window.webkitRequestFileSystem(PERSISTENT, grantedBytes, function(fs) {
                    fs.root.getFile(filecode + '.mob', {create: false}, function(fileEntry) {
                      fileEntry.remove(function() {
                        // console.log('File removed.');
                        const items: string[] = JSON.parse(localStorage.getItem('mobius_backup_list'));
                        const i = items.indexOf(filecode);
                        if (i !== -1) {
                            items.splice(i, 1);
                            localStorage.setItem('mobius_backup_list', JSON.stringify(items));
                        }
                      }, (e) => { console.log('Error', e); });
                    });
                });
            }, function(e) { console.log('Error', e); }
        );
    }

    static loadFile(filecode, callback) {
        const requestedBytes = 1024 * 1024 * 50;
        navigator.webkitPersistentStorage.requestQuota (
            requestedBytes, function(grantedBytes) {
                // @ts-ignore
                window.webkitRequestFileSystem(PERSISTENT, grantedBytes, function(fs) {
                    fs.root.getFile(filecode + '.mob', {}, function(fileEntry) {
                        fileEntry.file((file) => {
                            const reader = new FileReader();
                            reader.onerror = () => {
                                callback('error');
                            };
                            reader.onloadend = () => {
                                callback(reader.result);
                            };
                            reader.readAsText(file, 'text/plain;charset=utf-8');
                        });
                    });
                });
            }, function(e) { console.log('Error', e); }
        );
    }

    static checkDisappearedNodes(checkNode: INode, nodeList: INode[]) {
        for (const node of nodeList) {
            if (node.id === checkNode.id) {
                return true;
            }
        }
        nodeList.splice(nodeList.length - 1, 0, checkNode);
    }

    static clearResolvedValue(prodList: IProcedure[]) {
        prodList.forEach(prod => {
            if (prod.hasOwnProperty('resolvedValue')) {
                prod.resolvedValue = undefined;
            }
            if (prod.children) {
                SaveFileComponent.clearResolvedValue(prod.children);
            }
        });
    }

    async download() {
        const f = this.dataService.file;
        f.settings = localStorage.getItem('mpm_settings');

        for (const edge of f.flowchart.edges) {
            SaveFileComponent.checkDisappearedNodes(edge.source.parentNode, f.flowchart.nodes);
            SaveFileComponent.checkDisappearedNodes(edge.target.parentNode, f.flowchart.nodes);
        }

        if (!f.flowchart.ordered) {
            FlowchartUtils.orderNodes(f.flowchart);
        }

        for (const prod of f.flowchart.nodes[0].procedure) {
            if (prod.type !== ProcedureTypes.Constant) { continue; }
            if (prod.meta.inputMode.toString() === InputType.File.toString()) {
                const arg = prod.args[1];
                if (arg.value && arg.value.lastModified) {
                    const p = new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = function () {
                            resolve(reader.result);
                        };
                        reader.readAsText(arg.value);
                    });
                    window.localStorage.setItem(arg.value.name, '`' + await p + '`');
                    arg.value = { 'name': arg.value.name };
                }
                if (arg.value && arg.value.lastModified) {
                    const p = new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = function () {
                            resolve(reader.result);
                        };
                        reader.readAsText(arg.value);
                    });
                    window.localStorage.setItem(arg.value.name, '`' + await p + '`');
                    arg.value = { 'name': arg.value.name };
                }
            }
        }

        const modelMap = {};
        for (const node of f.flowchart.nodes) {
            modelMap[node.id] = node.model;
            node.model = undefined;
            if (node.input.hasOwnProperty('value')) {
                node.input.value = undefined;
            }
            if (node.output.hasOwnProperty('value')) {
                node.output.value = undefined;
            }
            SaveFileComponent.clearResolvedValue(node.procedure);
            for (const prod of node.procedure) {
                if (prod.hasOwnProperty('resolvedValue')) {
                    prod.resolvedValue = undefined;
                }
            }
        }

        const savedfile = circularJSON.parse(circularJSON.stringify(f));
        for (const node of savedfile.flowchart.nodes) {
            node.id = IdGenerator.getNodeID();
            for (const prod of node.state.procedure) {
                prod.selected = false;
            }
            node.state.procedure = [];
        }

        // **** need to modify this when changing the input's constant function:
        // **** this part resets the value of the last argument of the function when saving the file
        /*
        for (const prod of savedfile.flowchart.nodes[0].procedure) {
            prod.args[prod.argCount - 1].value = undefined;
        }
        */

        savedfile.flowchart.meta.selected_nodes = [0];
        savedfile.flowchart.last_updated = new Date();
        for (const edge of savedfile.flowchart.edges) {
            edge.selected = false;
        }

        if (!savedfile.name || savedfile.name === '' || savedfile.name.toLowerCase() === 'untitled') {
            savedfile.name = savedfile.flowchart.name;
        }
        const fileString = circularJSON.stringify(savedfile, null, 4);
        let fname = savedfile.name.replace(/\ /g, '_');
        if (savedfile.name.length < 4 || savedfile.name.substring(savedfile.name.length - 4) !== '.mob') {
            fname = `${fname}.mob`;
        }
        const blob = new Blob([fileString], { type: 'application/json' });

        try {
            SaveFileComponent.saveToLocalStorage(savedfile.flowchart.id, savedfile.flowchart.name, fileString);
        } catch (ex) {
            console.log('Unable to save file to local storage');
        }

        DownloadUtils.downloadFile(fname, blob);
        for (const node of f.flowchart.nodes) {
            node.model = modelMap[node.id];
        }
        this.dataService.file.name = 'Untitled';
    }

}
