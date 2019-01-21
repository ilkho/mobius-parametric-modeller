import { Component, Input, OnInit, DoCheck, AfterViewInit, AfterViewChecked, OnDestroy } from '@angular/core';
import { DataService } from '@services';

/**
 * ConsoleViewerComponent
 */
@Component({
    selector: 'console-viewer',
    templateUrl: './console-viewer.component.html',
    styleUrls: ['./console-viewer.component.scss']
})
export class ConsoleViewerComponent implements OnInit, AfterViewInit, DoCheck, AfterViewChecked, OnDestroy {
    text: string;
    scrollcheck: boolean;
    logs: string[];

    /**
     * constructor
     */
    constructor(private dataService: DataService) {
    }

    ngOnDestroy() {
        const ct = document.getElementById('console-container');
        if (!ct) { return; }
        this.dataService.consoleScroll = ct.scrollTop;
    }

    /**
     * ngOnInit
     */
    ngOnInit() {
        this.text = this.dataService.getLog().join('\n');
    }

    /**
     * ngOnInit
     */
    ngAfterViewInit() {
        const ct = document.getElementById('console-container');
        if (! this.dataService.consoleScroll) {
            ct.scrollTop = ct.scrollHeight;
        } else {
            ct.scrollTop = this.dataService.consoleScroll;
        }
    }

    /**
     * ngDoCheck
     */
    ngDoCheck() {
        if (this.dataService.getLog().length > 500) {
            this.dataService.spliceLog(500);
        }
        const t = this.dataService.getLog().join('\n');
        this.logs = this.dataService.getLog();
        if (this.text !== t) {
            this.text = t;
            this.scrollcheck = true;
        }
    }

    ngAfterViewChecked() {
        if (this.dataService.consoleScroll) {
            this.dataService.consoleScroll = undefined;
        } else if (this.scrollcheck) {
            const ct = document.getElementById('console-container');
            ct.scrollTop = ct.scrollHeight;
            this.scrollcheck = false;
        }
    }

    clearConsole() {
        this.dataService.clearLog();
    }
}
