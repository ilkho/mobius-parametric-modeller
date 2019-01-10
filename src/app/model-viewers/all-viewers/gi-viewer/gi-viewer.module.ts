import { AngularSplitModule } from 'angular-split';
import { NgxPaginationModule} from 'ngx-pagination';
// import @angular stuff
import { NgModule, ModuleWithProviders } from '@angular/core';
import { MatSliderModule } from '@angular/material/slider';
import { CommonModule } from '@angular/common';

import { MatTooltipModule} from '@angular/material/tooltip';
import { MatIconModule} from '@angular/material';
import { MatExpansionModule} from '@angular/material/expansion';

import { AttributeModule } from './attribute/attribute.module';

// import app components
import { GIViewerComponent } from './gi-viewer.component';
import { ThreejsViewerComponent } from './threejs/threejs-viewer.component';
import { AttributeComponent } from './attribute/attribute.component';

import { TabComponent } from './attribute/tab.component';
import { TabsComponent } from './attribute/tabs.component';
import { DropdownMenuComponent } from './html/dropdown-menu.component';
import { ModalWindowComponent } from './html/modal-window.component';
import { ModalService } from './html/modal-window.service';
import { FormsModule } from '@angular/forms';
/**
 * GIViewer
 * A viewer for Geo-Info models.
 */
@NgModule({
    declarations: [
        GIViewerComponent,
        ThreejsViewerComponent,
        AttributeComponent,
        TabComponent,
        TabsComponent,
        DropdownMenuComponent,
        ModalWindowComponent
    ],
    exports: [
        GIViewerComponent
    ],
    imports: [
        CommonModule,
        AngularSplitModule,
        MatSliderModule,
        MatIconModule,
        NgxPaginationModule,
        MatExpansionModule,
        MatTooltipModule,
        AttributeModule,
        FormsModule
    ],
    providers: [
        ModalService
    ]
})
export class GIViewerModule {
     static forRoot(): ModuleWithProviders {
        return {
            ngModule: GIViewerModule
        };
    }
}
