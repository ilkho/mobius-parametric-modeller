import { Component, Input, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { ProcedureItemComponent } from '../../procedure-item/procedure-item.component';
import { IProcedure, ProcedureTypes } from '@models/procedure';
import { InputType } from '@models/port';
const keys = Object.keys(InputType);
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.font = '13px Arial';

@Component({
  selector: 'procedure-input-editor',
  templateUrl: './procedure-input-editor.component.html',
  styleUrls: ['./procedure-input-editor.component.scss']
})
export class ProcedureInputEditorComponent implements AfterViewInit {

    @Input() prod: IProcedure;
    @Output() delete = new EventEmitter();
    @Output() selectInp = new EventEmitter();

    PortTypes = InputType;
    PortTypesArr = keys.slice(keys.length / 2);

    constructor() {
    }

    ngAfterViewInit() {
        const textarea = document.getElementById(this.prod.ID + '_desc');
        if (textarea) {
            const desc = this.prod.meta.description.split('\n');
            const textareaWidth = textarea.getBoundingClientRect().width - 20;
            let lineCount = 0;
            for (const line of desc) {
                lineCount += Math.floor(ctx.measureText(line).width / textareaWidth) + 1;
            }
            textarea.style.height = lineCount * 14 + 4 + 'px';
        }
    }

    selectInput(event: MouseEvent) {
        event.stopPropagation();
        this.selectInp.emit({'ctrl': event.ctrlKey, 'prod': this.prod});
    }

    editOptions(): void { }

    openFileBrowse(id) {
        document.getElementById(`file_${id}`).click();
    }
    onFileChange(event) {
        this.prod.args[this.prod.argCount - 1].default = event.target.files[0];
    }

    inputSize(val, defaultVal) {
        if (val === undefined || val === '') { return ctx.measureText(defaultVal).width + 2; }
        return ctx.measureText(val).width + 2;
    }

    // delete this procedure
    deleteProd(): void {
        this.delete.emit();
    }

    markDisabled() {
        this.prod.enabled = !this.prod.enabled;
    }

    updateMin(args, event) {
        if (event.type === 'keyup' && event.which !== 13) { return; }
        const currentVal = Number(event.target.value);
        if (currentVal !== 0 && !currentVal) { return; }
        if (Number(args.max) && Number(args.max) < currentVal) {
            args.min = args.max;
            event.target.value = args.min;
        } else {
            args.min = event.target.value;
        }
        if (!args.default || args.default < Number(args.min)) {
            args.default = Number(args.min);
        }
    }

    updateMax(args, event) {
        if (event.type === 'keyup' && event.which !== 13) { return; }
        const currentVal = Number(event.target.value);
        if (currentVal !== 0 && !currentVal) { return; }
        if (Number(args.min) && Number(args.min) > currentVal) {
            args.max = args.min;
            event.target.value = args.max;
        } else {
            args.max = event.target.value;
        }
        if (!args.default || args.default > Number(args.max)) {
            args.default = Number(args.max);
        }
    }

    // modify variable input: replace space " " with underscore "_"
    varMod(event: string) {
        if (!event) { return event; }
        return ProcedureItemComponent.modifyVarArg(event, this.prod.args[0]);
    }


}
