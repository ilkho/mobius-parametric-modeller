import { GIModel } from '@libs/geo-info/GIModel';
// import @angular stuff
import {
    Component, OnInit, Input, Output, EventEmitter,
    Injector, ElementRef, DoCheck, OnChanges, SimpleChanges, ViewChild, OnDestroy
} from '@angular/core';
import { DataThreejs } from '../data/data.threejs';
// import { IModel } from 'gs-json';
import { DataService } from '../data/data.service';
import { EEntType, EEntStrToGeomArray, EEntTypeStr, Txyz } from '@libs/geo-info/common';
import { DropdownMenuComponent } from '../html/dropdown-menu.component';
import { ModalService } from '../html/modal-window.service';
import { ThreeJSViewerService } from './threejs-viewer.service';
import { sortByKey } from '@libs/util/maps';
import { KeyboardService } from '@shared/services';
import { Subscription } from 'rxjs';

let renderCheck = true;

/**
 * A threejs viewer for viewing geo-info (GI) models.
 * This component gets used in /app/model-viewers/all-viewers/gi-viewer/gi-viewer.component.html
 */
@Component({
    selector: 'threejs-viewer',
    templateUrl: './threejs-viewer.component.html',
    styleUrls: ['./threejs-viewer.component.scss']
})
export class ThreejsViewerComponent implements OnInit, DoCheck, OnChanges, OnDestroy {
    @Output() eventClicked = new EventEmitter<Event>();
    @Output() resetTableEvent = new EventEmitter<number>();
    @Input() model: GIModel;
    @Input() attr_table_select: { action: string, ent_type: string, id: number | number[] };
    @Input() selectSwitch: Boolean;
    @Input() attribLabel: string;
    @ViewChild(DropdownMenuComponent, { static: true }) dropdown = new DropdownMenuComponent();

    protected modalWindow: ModalService;
    // protected keyboardService: KeyboardService;
    // private keyboardServiceSub: Subscription;
    public container = null;
    public _elem;
    // viewer size
    public _width: number;
    public _height: number;
    // DataService
    protected dataService: DataService;
    // threeJS scene data
    public _data_threejs: DataThreejs;
    // num of positions, edges, triangles in threejs
    public _threejs_nums: [number, number, number];
    // flags for displayinhg text in viewer, see html
    public _no_model = false;
    public _model_error = false;
    public messageVisible = false;
    public message: string;
    // the selectable type of entity by user, depends on the Attribute Tab
    public selectable: number;

    // right selection dropdown
    // public needSelect = false;
    // current entity type enabled for selection
    public SelectingEntityType: { id: number, name: string } = { id: EEntType.FACE, name: 'Faces' };
    public selectDropdownVisible = false;
    public selections = [
        { id: EEntType.POSI, name: 'Positions' }, { id: EEntType.VERT, name: 'Vertex' },
        { id: EEntType.EDGE, name: 'Edges' }, { id: EEntType.WIRE, name: 'Wires' },
        { id: EEntType.FACE, name: 'Faces' }, { id: EEntType.POINT, name: 'Points' },
        { id: EEntType.PLINE, name: 'Polylines' }, { id: EEntType.PGON, name: 'Polygons' },
        { id: EEntType.COLL, name: 'Collections' }];

    public dropdownPosition = { x: 0, y: 0 };

    private renderInterval;
    private isDown = false;
    private lastX: number;
    private lastY: number;
    private dragHash: number;
    private shiftKeyPressed = false;
    public giSummary = [];
    private currentAttribLabel = '';

    tab_map = {
        0: EEntType.POSI,
        1: EEntType.VERT,
        2: EEntType.EDGE,
        3: EEntType.WIRE,
        4: EEntType.FACE,
        5: EEntType.POINT,
        6: EEntType.PLINE,
        7: EEntType.PGON,
        8: EEntType.COLL,
        9: EEntType.MOD
    };

    tab_rev_map = {
        0: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5, // point
        7: 6, // plines
        8: 7, // pgons
        9: 8,
        10: 9
    };

    /**
     * Creates a new viewer,
     * @param injector
     * @param elem
     */
    constructor(injector: Injector, elem: ElementRef, private threeJSViewerService: ThreeJSViewerService) {
        this._elem = elem;
        this.dataService = injector.get(DataService);
        this.modalWindow = injector.get(ModalService);
        // this.keyboardService = injector.get(KeyboardService);
        // this.keyboardServiceSub = this.keyboardService.viewerControl$.subscribe(event => {
        //     this._data_threejs.onWindowKeyPress(event);
        // });
    }
    /**
     * Called when the viewer is initialised.
     */
    ngOnInit() {
        this.dropdown.items = [];
        this.dropdown.visible = false;
        this.dropdown.position = { x: 0, y: 0 };
        this.container = this._elem.nativeElement.children.namedItem('threejs-container');
        // check for container
        if (!this.container) {
            console.error('No container in Three Viewer');
            return;
        }
        // size of window
        this._width = this.container.offsetWidth; // container.client_width;
        this._height = this.container.offsetHeight; // container.client_height;

        this._data_threejs = this.dataService.getThreejsScene();
        this.threeJSViewerService.DataThreejs = this._data_threejs;
        this.container.appendChild(this._data_threejs._renderer.domElement);
        // set the numbers of entities
        this._threejs_nums = this._data_threejs._threejs_nums;
        // ??? What is happening here?
        this._data_threejs._controls.addEventListener('change', this.activateRender);
        this._data_threejs._renderer.render(this._data_threejs._scene, this._data_threejs._camera);

        if (this._data_threejs.ObjLabelMap.size !== 0) {
            this._data_threejs.ObjLabelMap.forEach((obj, label) => {
                this._data_threejs.createLabelforObj(this.container, obj.entity, obj.type, obj.text, label);
            });
        }

        this.getSelectingEntityType();

        for (let i = 1; i < 10; i++) {
            setTimeout(() => {
                this.activateRender();
            }, i * 100);
        }

        this.renderInterval = setInterval(() => {
            // this.render();
            if (renderCheck) {
                this.render();
                renderCheck = false;
            }
        }, 20);
    }

    /**
     * Called when anything changes
     */
    ngDoCheck() {
        if (!this.container) {
            console.error('No container in Three Viewer');
            return;
        }
        const width: number = this.container.offsetWidth;
        const height: number = this.container.offsetHeight;

        // this is when dimensions change
        if (width !== this._width || height !== this._height) {
            this._width = width;
            this._height = height;
            setTimeout(() => {
                this._data_threejs._camera.aspect = this._width / this._height;
                this._data_threejs._camera.updateProjectionMatrix();
                this._data_threejs._renderer.setSize(this._width, this._height);
                this.activateRender();
            }, 10);
        }

        if (renderCheck) {
            this.render();
            renderCheck = false;
        }
        // this.render();

    }

    // receive data -> model from gi-viewer component and update model in the scene
    ngOnChanges(changes: SimpleChanges) {
        if (changes['model']) {
            if (this.model) {
                if (this.dataService.switch_page) {
                    this.dataService.switch_page = false;
                    return;
                }
                this.updateModel(this.model);
            }
        }
        if (changes['attr_table_select']) {
            if (this.attr_table_select) {
                this.attrTableSelect(this.attr_table_select);
            }
        }
        if (changes['selectSwitch']) {
            if (this.selectSwitch !== undefined) {
                const ent_type = this.tab_map[this.getCurrentTab()];
                this.refreshLabels(ent_type);
            }
        }
        if (changes['attribLabel']) {
            if (this.attribLabel !== undefined) {
                const ent_type = this.tab_map[this.getCurrentTab()];
                this.currentAttribLabel = this.attribLabel;
                this.refreshLabels(ent_type);
            }
        }
    }

    ngOnDestroy() {
        this._elem = null;
        this.container = null;
        this.dataService.switch_page = true;
        this.model = null;
        clearInterval(this.renderInterval);
        this.renderInterval = null;
        this._data_threejs._controls.removeEventListener('change', this.activateRender);
        // this.keyboardServiceSub.unsubscribe();
    }

    public activateRender() {
        renderCheck = true;
    }

    /**
     * @param self
     */
    public render() {
        const textLabels = this._data_threejs._textLabels;
        if (textLabels.size !== 0) {
            textLabels.forEach((label) => {
                label.updatePosition();
            });
        }
        this._data_threejs._renderer.render(this._data_threejs._scene, this._data_threejs._camera);
    }


    getCurrentTab() {
        if (localStorage.getItem('mpm_attrib_current_tab') !== null) {
            return Number(localStorage.getItem('mpm_attrib_current_tab'));
        } else {
            return 0;
        }
    }


    refreshLabels(ent_type): void {
        const allLabels = document.getElementsByClassName(`text-label${EEntTypeStr[ent_type]}`);
        const unSorted = this.dataService.selected_ents.get(EEntTypeStr[ent_type]);
        if (unSorted === undefined) {
            return;
        }
        const sorted = sortByKey(unSorted);
        const arr = Array.from(sorted.values());
        const showSelected = JSON.parse(sessionStorage.getItem('mpm_showSelected'));
        const attr_names = this._data_threejs._model.attribs.query.getAttribNames(ent_type);

        let attr_name = this.currentAttribLabel, isArr = false, key;
        if (attr_name.match(/\[.*?\]/g)) {
            isArr = true;
            const _key = String(attr_name.match(/\[.*?\]/g));
            const _attr_name = attr_name.replace(_key, '');
            key = Number(_key.replace('[', '').replace(']', ''));
            attr_name = _attr_name;
        } else {
            isArr = false;
        }
        if (attr_name !== '') {
            if (attr_names.includes(attr_name)) {
                for (let i = 0; i < allLabels.length; i++) {
                    const element = allLabels[i];
                    const attr = Number(element.getAttribute('data-index'));
                    const attr_val = this._data_threejs._model.attribs.query.getAttribVal(ent_type, attr_name, attr);
                    const _attr_val = attr_val !== undefined ? attr_val : '';
                    if (isArr && _attr_val !== '') {
                        const val = String(_attr_val).split(',')[key];
                        const _val = val !== undefined ? val : '';
                        element.innerHTML = _val;
                    } else {
                        element.innerHTML = String(_attr_val);
                    }
                }
            } else if (attr_name === '#') {
                this.labelforindex(showSelected, allLabels, arr);
            } else if (attr_name === '_id') {
                for (let i = 0; i < allLabels.length; i++) {
                    const element = allLabels[i];
                    const val = element.getAttribute('title');
                    element.innerHTML = String(val);
                }
            }
        } else {
            this.labelforindex(showSelected, allLabels, arr);
            for (let i = 0; i < allLabels.length; i++) {
                const element = allLabels[i];
                element.innerHTML = String('');
            }
        }
        this.activateRender();
        setTimeout(() => {
            this.activateRender();
        }, 50);

        // this.render();
    }

    labelforindex(showSelected, allLabels, arr) {
        if (showSelected) {
            for (let i = 0; i < allLabels.length; i++) {
                const element = allLabels[i];
                const val = Number(element.getAttribute('data-index'));
                const index = arr.findIndex(l => l === val);
                element.innerHTML = String(index);
            }
        } else {
            const ent_arr = this.model.geom.query.getEnts(this.SelectingEntityType.id, false);
            for (let i = 0; i < allLabels.length; i++) {
                const element = allLabels[i];
                const val = Number(element.getAttribute('data-index'));
                const index = ent_arr.findIndex(l => l === val);
                element.innerHTML = String(index);
            }
        }
    }

    attrTableSelect(attrib: { action: string, ent_type: string, id: number | number[] }, flowchart = false) {
        sessionStorage.setItem('mpm_changetab', 'false');
        if (attrib.action === 'select') {
            if (!flowchart) {this.unselectAll(); } // If select from Flowchart, don't unselect all.
            switch (attrib.ent_type) {
                case EEntTypeStr[EEntType.POSI]:
                    if (typeof attrib.id === 'number') {
                        this.selectPositions(attrib.id, null, null, attrib.ent_type + attrib.id);
                    } else {
                        attrib.id.forEach((_id) => {
                            this.selectPositions(_id, null, null, attrib.ent_type + _id);
                        });
                    }
                    break;
                case EEntTypeStr[EEntType.VERT]:
                    if (typeof attrib.id === 'number') {
                        this.selectVertex(attrib.id, null, null, attrib.ent_type + attrib.id);
                    } else {
                        attrib.id.forEach((_id) => {
                            this.selectVertex(_id, null, null, attrib.ent_type + _id);
                        });
                    }
                    break;
                case EEntTypeStr[EEntType.EDGE]:
                    if (typeof attrib.id === 'number') {
                        this.selectEdge(attrib.id);
                    } else {
                        attrib.id.forEach((_id) => {
                            this.selectEdge(_id);
                        });
                    }
                    break;
                case EEntTypeStr[EEntType.WIRE]:
                    if (typeof attrib.id === 'number') {
                        this.selectWire(attrib.id);
                    } else {
                        attrib.id.forEach((_id) => {
                            this.selectWire(_id);
                        });
                    }
                    break;
                case EEntTypeStr[EEntType.FACE]:
                    if (typeof attrib.id === 'number') {
                        this.selectFace(attrib.id);
                    } else {
                        attrib.id.forEach((_id) => {
                            this.selectFace(_id);
                        });
                    }
                    break;
                case EEntTypeStr[EEntType.PGON]:
                    if (typeof attrib.id === 'number') {
                        this.selectPGon(attrib.id);
                    } else {
                        attrib.id.forEach((_id) => {
                            this.selectPGon(_id);
                        });
                    }
                    break;
                case EEntTypeStr[EEntType.PLINE]:
                    if (typeof attrib.id === 'number') {
                        this.selectPLine(attrib.id);
                    } else {
                        attrib.id.forEach((_id) => {
                            this.selectPLine(_id);
                        });
                    }
                    break;
                case EEntTypeStr[EEntType.POINT]:
                    if (typeof attrib.id === 'number') {
                        this.selectPoint(attrib.id);
                    } else {
                        attrib.id.forEach((_id) => {
                            this.selectPoint(_id);
                        });
                    }
                    break;
                case EEntTypeStr[EEntType.COLL]:
                    if (typeof attrib.id === 'number') {
                        // const coll_parents = this.model.geom.query.getCollParents(attrib.id);
                        // if (coll_parents[0] === -1) { // no parent
                        //     this.chooseColl(attrib.id);
                        // } else {
                        //     coll_parents.forEach(element => {
                        //         this.chooseColl(element);
                        //     });
                        // }
                        const parent_coll_i: number = this.model.geom.query.getCollParent(attrib.id);
                        if (parent_coll_i === -1) { // no parent
                            this.chooseColl(attrib.id);
                        }
                    } else {
                        attrib.id.forEach((_id) => {
                            this.chooseColl(_id);
                        });
                    }
                    break;
                default:
                    break;
            }
        } else if (attrib.action === 'unselect') {
            if (attrib.ent_type === EEntTypeStr[EEntType.COLL]) {
                const coll_children = this.dataService.selected_coll.get(attrib.ent_type + attrib.id);
                if (coll_children && coll_children.length) {
                    coll_children.forEach(child => {
                        this.unselectGeom(child, attrib.ent_type, true);
                    });
                    this.dataService.selected_ents.get(EEntTypeStr[EEntType.COLL]).delete(attrib.ent_type + attrib.id);
                }
            } else {
                this.unselectGeom(attrib.ent_type + attrib.id, attrib.ent_type, true);
            }
        }
        this.refreshLabels(this.tab_map[this.getCurrentTab()]);
    }

    getGISummary(model: GIModel) {
        let colls = 0, pgons = 0, plines = 0, points = 0, faces = 0, wires = 0, edges = 0, vertices = 0, positions = 0;
        if (this) {
            colls = model.geom.query.numEnts(EEntType.COLL, false);
            pgons = model.geom.query.numEnts(EEntType.PGON, false);
            plines = model.geom.query.numEnts(EEntType.PLINE, false);
            points = model.geom.query.numEnts(EEntType.POINT, false);
            faces = model.geom.query.numEnts(EEntType.FACE, false);
            wires = model.geom.query.numEnts(EEntType.WIRE, false);
            edges = model.geom.query.numEnts(EEntType.EDGE, false);
            vertices = model.geom.query.numEnts(EEntType.VERT, false);
            positions = model.geom.query.numEnts(EEntType.POSI, false);
        }
        const gi_summary = [{title: 'Collections', val: colls},
        {title: 'Polygons', val: pgons},
        {title: 'Polylines', val: plines},
        {title: 'Points', val: points},
        {title: 'Faces', val: faces},
        {title: 'Wires', val: wires},
        {title: 'Edges', val: edges},
        {title: 'Vertices', val: vertices},
        {title: 'Positions', val: positions}];
        localStorage.setItem('gi_summary', JSON.stringify(gi_summary));
    }

    /**
     * Update the model in the viewer.
     */
    public async updateModel(model: GIModel) {
        this._data_threejs = this.dataService.getThreejsScene();
        if (!model) {
            console.warn('Model or Scene not defined.');
            this._no_model = true;
            return;
        } else {
            // if (model !== this._data_threejs._model) {
                this._data_threejs._model = model;
                try {
                    // add geometry to the scene
                    this._data_threejs.addGeometry(model, this.container);
                    // this.resetTable();
                    this.getGISummary(model);
                    if (localStorage.getItem('gi_summary')) {
                        this.giSummary = JSON.parse(localStorage.getItem('gi_summary'));
                    }
                    this._model_error = false;
                    this._no_model = false;

                    // Show Flowchart Selected Entities
                    const selected = this.model.geom.selected;
                    this.dataService.clearAll();
                    if (selected !== undefined && selected.length) {
                        let selectingType;
                        this._data_threejs.selected_geoms.clear();
                        selected.forEach(s => {
                            const type = EEntTypeStr[s[0]], id = Number(s[1]);
                            if (this.model.geom.query.entExists(s[0], id)) {
                                this.dataService.selected_ents.get(type).set(`${type}${id}`, id);
                                this.attrTableSelect({ action: 'select', ent_type: type, id: id }, true);
                            }
                            selectingType = s[0];
                        });
                        sessionStorage.setItem('mpm_showSelected', 'true');

                        sessionStorage.setItem('mpm_changetab', 'true');
                        localStorage.setItem('mpm_attrib_current_tab', this.tab_rev_map[selectingType]);
                        this.selectEntityType(this.selections.find(selection => selection.id === selectingType));
                    } else {
                        sessionStorage.setItem('mpm_showSelected', 'false');
                        sessionStorage.setItem('mpm_changetab', 'false');
                    }
                    this.getSelectingEntityType();
                    this.refreshTable(event);

                } catch (ex) {
                    console.error('Error displaying model:', ex);
                    this._model_error = true;
                    this._data_threejs._text = ex;
                }
            }
        // }
    }

    onMouseUp(event) {
        if (event.target.tagName !== 'CANVAS') {
            return null;
        } else {
            if (this.dragHash < 10) {
                this.onUserAction(event);
                this.refreshLabels(this.tab_map[this.getCurrentTab()]);
            } else {
                // this._data_threejs._controls.enabled = true;
            }
            this.isDown = false;
        }
    }

    public onMouseMove(event) {
        const body = document.getElementsByTagName('body');

        if (event.target.tagName !== 'CANVAS') {
            // body[0].style.cursor = 'default';
            return null;
        } else {

            if (!this.isDown) {
                // const intersects = this.threeJSViewerService.initRaycaster(event);
                // if (intersects && intersects.length > 0) {
                //     body[0].style.cursor = 'pointer';
                // } else {
                //     body[0].style.cursor = 'default';
                // }
                return;
            }

            const mouseX = event.clientX - event.target.getBoundingClientRect().left;
            const mouseY = event.clientY - event.target.getBoundingClientRect().top;
            const dx = mouseX - this.lastX;
            const dy = mouseY - this.lastY;
            this.lastX = mouseX;
            this.lastY = mouseY;

            this.dragHash += Math.abs(dx) + Math.abs(dy);
            if (this.dragHash > 4) {
                // dragging
            }
        }
    }

    onMouseDown(event) {
        if (event.target.tagName !== 'CANVAS') {
            return null;
        } else {
            event.stopPropagation();

            this.lastX = event.clientX - event.target.getBoundingClientRect().left;
            this.lastY = event.clientY - event.target.getBoundingClientRect().top;

            // Put your mousedown stuff here
            this.dragHash = 0;
            this.isDown = true;
        }
    }

    onKeyDown(event) {
    }

    onKeyUp(event) {
    }

    public onUserAction(event) {
        // get entities for mouse event
        const intersects = this.threeJSViewerService.initRaycaster(event);
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            this.shiftKeyPressed = true;
        }

        // check intersect exist
        if (intersects.length > 0) {
            if (event.which === 1) {
                // check mouse event triggered in THREE viewer, then enable dropdown menu
                if (event.target.tagName === 'CANVAS') {
                    const pos_x = event.clientX - event.target.getBoundingClientRect().left;
                    const pos_y = event.clientY - event.target.getBoundingClientRect().top;
                    this.dropdownPosition = { x: pos_x, y: pos_y };
                }
                let intsType = '';
                switch (this.SelectingEntityType.id) {
                    case EEntType.POSI:
                    case EEntType.POINT:
                    case EEntType.VERT:
                        intsType = 'Points';
                        break;
                    case EEntType.EDGE:
                    case EEntType.WIRE:
                    case EEntType.PLINE:
                        intsType = 'LineSegments';
                        break;
                    case EEntType.FACE:
                    case EEntType.PGON:
                        intsType = 'Mesh';
                        break;
                }

                let intsObj = intersects[0];
                for (const inst of intersects) {
                    if (inst.object.type === intsType) {
                        intsObj = inst;
                        break;
                    }
                }
                this.selectObj(intsObj);
                // setTimeout(() => {
                //     this.activateRender();
                // }, 50);
            }
        } else {
            if (event.target.tagName === 'CANVAS') {
                this.unselectAll();
                this.resetTable();
                if (event.target.tagName !== 'OL') {
                    // not clicking on Menu item, hide dropdown menu
                    this.dropdown.visible = false;
                    // return;
                }
            }
        }
        this.shiftKeyPressed = false;

        this.refreshTable(event);
    }

    private refreshTable(event: Event) {
        this.eventClicked.emit(event);
        this.activateRender();
    }

    private resetTable() {
        this.resetTableEvent.emit();
    }

    private unselectAll() {
        const scene = this._data_threejs;
        const selectings = Array.from(scene.selected_geoms.keys());
        for (const selecting of selectings) {
            scene.unselectObj(selecting, this.container);
        }
        document.querySelectorAll('[id^=textLabel_]').forEach(value => {
            this.container.removeChild(value);
        });
        this._data_threejs._textLabels.clear();

        this.dataService.selected_ents.forEach(map => {
            map.clear();
        });
        this.refreshTable(event);
        scene.sceneObjsSelected.clear();
        // if (this.SelectingEntityType.id === EEntTypeStr[EEntType.COLL]) {
        //     document.getElementById('executeButton').click();
        // }
        const positions = Array.from(scene.selected_positions.keys());
        for (const posi of positions) {
            scene.unselectObjGroup(posi, this.container, 'positions');
        }

        const vertex = Array.from(scene.selected_vertex.keys());
        for (const vert of vertex) {
            scene.unselectObjGroup(vert, this.container, 'vertex');
        }

        const edges = Array.from(scene.selected_face_edges.keys());
        for (const edge of edges) {
            scene.unselectObjGroup(edge, this.container, 'face_edges');
        }

        const wires = Array.from(scene.selected_face_wires.keys());
        for (const wire of wires) {
            scene.unselectObjGroup(wire, this.container, 'face_wires');
        }

        this.activateRender();
    }

    private getSelectingEntityType() {
        const select = JSON.parse(localStorage.getItem('mpm_settings'))['select'];
        if (select !== undefined && select.selector) {
            this.SelectingEntityType = select.selector;
        } else {
            this.SelectingEntityType = {id: EEntType.FACE, name: 'Faces'};
        }
        // if (localStorage.getItem('mpm_selecting_entity_type') != null) {
        //     this.SelectingEntityType = JSON.parse(localStorage.getItem('mpm_selecting_entity_type'));
        // }
    }

    private selectObj(intersect0: THREE.Intersection) {
        const scene = this._data_threejs;
        // this.getSelectingEntityType();
        switch (this.SelectingEntityType.id) {
            case EEntType.POSI:

                if (intersect0.object.type === 'Points') {
                    let posi = 0;
                    for (const m of scene.posis_map) {
                        if (m[1] === intersect0.index) {
                            posi = m[0];
                            break;
                        }
                    }
                    // const posi = scene.posis_map.get(intersect0.index);
                    const ent_id = `${EEntTypeStr[EEntType.POSI]}${posi}`;
                    if (scene.selected_geoms.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.POSI], true);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectPositions(posi, null, null, ent_id);
                    }
                } else if (intersect0.object.type === 'LineSegments') {
                    const edge = scene.edge_select_map.get(intersect0.index / 2);
                    const ent_id = `_e_posi${edge}`;
                    if (scene.selected_positions.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.POSI]);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectPositions(null, edge, null, ent_id);
                    }
                } else if (intersect0.object.type === 'Mesh') {
                    const tri = scene.tri_select_map.get(intersect0.faceIndex);
                    const face = this.model.geom.nav.navTriToFace(tri);
                    const ent_id = `_f_posi${face}`;
                    if (scene.selected_positions.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.POSI]);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectPositions(null, null, face, ent_id);
                    }
                }
                break;
            case EEntType.VERT:
                if (intersect0.object.type === 'Points') {
                    let posi = 0;
                    for (const m of scene.posis_map) {
                        if (m[1] === intersect0.index) {
                            posi = m[0];
                            break;
                        }
                    }
                    // const vert = scene.vertex_map.get(intersect0.index);
                    const verts = this.model.geom.nav.navPosiToVert(posi);
                    let point: number;
                    if (verts.length > 1) {
                        this.dropdown.setItems(verts, EEntTypeStr[EEntType.VERT]);
                        this.dropdown.visible = true;
                        this.dropdown.position = this.dropdownPosition;
                    } else {
                        let vert = 0;
                        for (const m of scene.vertex_map) {
                            if (m[1] === intersect0.index) {
                                vert = m[0];
                                break;
                            }
                        }
                        point = vert;
                    }
                    const ent_id = `${EEntTypeStr[EEntType.VERT]}${point}`;
                    if (scene.selected_geoms.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.VERT], true);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectVertex(point, null, null, ent_id);
                    }
                } else if (intersect0.object.type === 'LineSegments') {
                    const edge = scene.edge_select_map.get(intersect0.index / 2);
                    const ent_id = `_e_v${edge}`;
                    if (scene.selected_vertex.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.VERT]);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectVertex(null, edge, null, ent_id);
                    }
                } else if (intersect0.object.type === 'Mesh') {
                    const tri = scene.tri_select_map.get(intersect0.faceIndex);
                    const face = this.model.geom.nav.navTriToFace(tri);
                    const ent_id = `_f_v${face}`;
                    if (scene.selected_vertex.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.VERT]);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectVertex(null, null, face, ent_id);
                    }
                }
                break;
            case EEntType.COLL:
                if (!this.shiftKeyPressed) {
                    this.unselectAll();
                }
                this.selectColl(intersect0, intersect0.object.type);
                break;
            case EEntType.FACE:
                if (intersect0.object.type === 'Mesh') {
                    const tri = scene.tri_select_map.get(intersect0.faceIndex);
                    const face = this.model.geom.nav.navTriToFace(tri);
                    const ent_id = `${EEntTypeStr[EEntType.FACE]}${face}`;
                    if (scene.selected_geoms.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.FACE], true);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectFace(face);
                    }
                } else {
                    this.showMessages('Faces');
                }
                break;
            case EEntType.PGON:
                if (intersect0.object.type === 'Mesh') {
                    const tri = scene.tri_select_map.get(intersect0.faceIndex);
                    const face = this.model.geom.nav.navTriToFace(tri);
                    const pgon = this.model.geom.nav.navFaceToPgon(face);
                    const ent_id = `${EEntTypeStr[EEntType.PGON]}${pgon}`;
                    if (scene.selected_geoms.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.PGON], true);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectPGon(face);
                    }
                } else {
                    this.showMessages('Polygons');
                }
                break;
            case EEntType.EDGE:
                if (intersect0.object.type === 'LineSegments') {
                    const edge = scene.edge_select_map.get(intersect0.index / 2);
                    const ent_id = `${EEntTypeStr[EEntType.EDGE]}${edge}`;
                    if (scene.selected_geoms.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.EDGE], true);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectEdge(edge);
                    }
                } else if (intersect0.object.type === 'Mesh') {
                    const tri = scene.tri_select_map.get(intersect0.faceIndex);
                    const face = this.model.geom.nav.navTriToFace(tri);
                    const ent_id = `${EEntTypeStr[EEntType.FACE]}${face}`;
                    if (scene.selected_face_edges.has(ent_id)) {
                        this.unselectGeom(ent_id, 'face_edges');
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectEdgeByFace(face, ent_id);
                    }
                } else {
                    this.showMessages('Edges');
                }
                break;
            case EEntType.WIRE:
                if (intersect0.object.type === 'LineSegments') {
                    const edge = scene.edge_select_map.get(intersect0.index / 2),
                        wire = this.model.geom.nav.navEdgeToWire(edge);
                    const ent_id = `${EEntTypeStr[EEntType.WIRE]}${edge}`;
                    if (scene.selected_geoms.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.WIRE], true);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectWire(wire);
                    }
                } else if (intersect0.object.type === 'Mesh') {
                    const tri = scene.tri_select_map.get(intersect0.faceIndex);
                    const face = this.model.geom.nav.navTriToFace(tri);
                    const ent_id = `${EEntTypeStr[EEntType.FACE]}${face}`;
                    if (scene.selected_face_wires.has(ent_id)) {
                        this.unselectGeom(ent_id, 'face_wires');
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        this.selectWireByFace(face, ent_id);
                    }
                } else {
                    this.showMessages('Wires');
                }
                break;
            case EEntType.PLINE:
                if (intersect0.object.type === 'LineSegments') {
                    const edge = scene.edge_select_map.get(intersect0.index / 2);
                    const wire = this.model.geom.nav.navEdgeToWire(edge);
                    const pline = this.model.geom.nav.navWireToPline(wire);
                    const ent_id = `${EEntTypeStr[EEntType.PLINE]}${pline}`;
                    if (scene.selected_geoms.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.PLINE], true);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        if (pline !== undefined && pline !== null) {
                            this.selectPLine(pline);
                        } else {
                            this.showMessages('Selection is not a Polyline', 'custom');
                        }
                    }
                } else {
                    this.showMessages('Polylines');
                }
                break;
            case EEntType.POINT:
                if (intersect0.object.type === 'Points') {
                    const vert = this.model.geom.nav.navPosiToVert(intersect0.index);
                    const _point = this.model.geom.nav.navVertToPoint(vert[0]);
                    const point = scene.point_select_map.get(_point);
                    const ent_id = `${EEntTypeStr[EEntType.POINT]}${point}`;
                    if (scene.selected_geoms.has(ent_id)) {
                        this.unselectGeom(ent_id, EEntTypeStr[EEntType.POINT], true);
                    } else {
                        if (!this.shiftKeyPressed) {
                            this.unselectAll();
                        }
                        if (point !== undefined && point !== null) {
                            this.selectPoint(point);
                        } else {
                            this.showMessages('Selection is not a Point', 'custom');
                        }
                    }
                } else {
                    this.showMessages('Points');
                }
                break;
            default:
                this.showMessages('Please choose an Entity type.', 'custom');
                break;
        }
        // this.activateRender();
        // this.render();
    }

    private showMessages(msg: string, mode: string = 'notice') {
        switch (mode) {
            case 'custom':
                this.message = msg;
                break;
            case 'notice':
                this.message = `Please Select ${msg}`;
                break;
            default:
                break;
        }
        this.messageVisible = true;
        setTimeout(() => {
            this.messageVisible = false;
        }, 3000);
    }

    private selectPositions(point: number = null, edge: number = null, face: number = null, parent_ent_id: string) {
        const ent_type_str = EEntTypeStr[EEntType.POSI];
        const scene = this._data_threejs;
        const posi_ent = this.dataService.selected_ents.get(ent_type_str);
        if (point !== null) {
            const position = this.model.attribs.query.getPosiCoords(point);
            const ent_id = parent_ent_id;
            posi_ent.set(ent_id, point);
            const labelText = this.indexAsLabel(ent_type_str, ent_id, point, EEntType.POSI);
            scene.selectObjPosition(null, ent_id, position, this.container, labelText);
            this.dataService.selected_positions.set(`${parent_ent_id}`, [ent_id]);
        } else if (edge !== null) {
            const verts = this.model.geom.nav.navEdgeToVert(edge);
            const posis = verts.map(v => this.model.geom.nav.navVertToPosi(v));
            const children = [];
            posis.map(posi => {
                const ent_id = `${ent_type_str}${posi}`;
                const position = this.model.attribs.query.getPosiCoords(posi);
                posi_ent.set(ent_id, posi);
                const labelText = this.indexAsLabel(ent_type_str, ent_id, posi, EEntType.POSI);
                scene.selectObjPosition(parent_ent_id, ent_id, position, this.container, labelText);
                children.push(ent_id);
            });
            this.dataService.selected_positions.set(`${parent_ent_id}`, children);
        } else if (face !== null) {
            const tris = this.model.geom.nav.navFaceToTri(face),
                posis = tris.map(tri => this.model.geom.nav.navAnyToPosi(EEntType.TRI, tri)),
                posi_flat = [].concat(...posis);

            const uniqPositions = this.uniq(posi_flat);
            const children = [];
            uniqPositions.map(posi => {
                const ent_id = `${ent_type_str}${posi}`;
                const position = this.model.attribs.query.getPosiCoords(posi);
                posi_ent.set(ent_id, posi);
                const labelText = this.indexAsLabel(ent_type_str, ent_id, posi, EEntType.POSI);
                scene.selectObjPosition(parent_ent_id, ent_id, position, this.container, labelText);
                children.push(ent_id);
            });
            this.dataService.selected_positions.set(`${parent_ent_id}`, children);
        }
    }

    private uniq(a) {
        const seen = {};
        return a.filter(function (item) {
            return seen.hasOwnProperty(item) ? false : (seen[item] = true);
        });
    }

    private selectVertex(point: number = null, edge: number = null, face: number = null, parent_ent_id: string) {
        const ent_type_str = EEntTypeStr[EEntType.VERT];
        const posi_ent = this.dataService.selected_ents.get(ent_type_str);
        const scene = this._data_threejs;
        if (point !== null) {
            const position = this.model.attribs.query.getVertCoords(point);
            const ent_id = parent_ent_id;
            posi_ent.set(ent_id, point);
            const labelText = this.indexAsLabel(ent_type_str, ent_id, point, EEntType.VERT);
            scene.selectObjvertex(null, ent_id, position, this.container, labelText);
            this.dataService.selected_vertex.set(`${parent_ent_id}`, [ent_id]);
        } else if (edge !== null) {
            const verts = this.model.geom.nav.navEdgeToVert(edge);
            const children = [];
            verts.map(vert => {
                const ent_id = `${ent_type_str}${vert}`;
                const position = this.model.attribs.query.getVertCoords(vert);
                posi_ent.set(ent_id, vert);
                const labelText = this.indexAsLabel(ent_type_str, ent_id, vert, EEntType.VERT);
                scene.selectObjvertex(parent_ent_id, ent_id, position, this.container, labelText);
                children.push(ent_id);
            });
            this.dataService.selected_vertex.set(`${parent_ent_id}`, children);

        } else if (face !== null) {
            const tris = this.model.geom.nav.navFaceToTri(face),
                verts = tris.map(tri => this.model.geom.nav.navTriToVert(tri)),
                verts_flat = [].concat(...verts);

            const uniqVerts = this.uniq(verts_flat);
            const children = [];
            uniqVerts.map(vert => {
                const ent_id = `${ent_type_str}${vert}`;
                const position = this.model.attribs.query.getVertCoords(vert);
                posi_ent.set(ent_id, vert);
                const labelText = this.indexAsLabel(ent_type_str, ent_id, vert, EEntType.VERT);
                scene.selectObjvertex(parent_ent_id, ent_id, position, this.container, labelText);
                children.push(ent_id);
            });
            this.dataService.selected_vertex.set(`${parent_ent_id}`, children);
        }
    }

    private unselectGeom(ent_id: string, ent_type_str: string, direct = false) {
        const scene = this._data_threejs;
        if (!direct) {
            if (ent_type_str === EEntTypeStr[EEntType.POSI]) {
                this.unselectLabel(ent_id, ent_type_str);
                scene.unselectObjGroup(ent_id, this.container, 'positions');
                const children = this.dataService.selected_positions.get(ent_id);
                children.forEach(c => {
                    this.dataService.selected_ents.get(EEntTypeStr[EEntType.POSI]).delete(c);
                });
                this.dataService.selected_positions.delete(ent_id);

            } else if (ent_type_str === EEntTypeStr[EEntType.VERT]) {
                this.unselectLabel(ent_id, ent_type_str);
                scene.unselectObjGroup(ent_id, this.container, 'vertex');
                const children = this.dataService.selected_vertex.get(ent_id);
                children.forEach(c => {
                    this.dataService.selected_ents.get(EEntTypeStr[EEntType.VERT]).delete(c);
                });
                this.dataService.selected_vertex.delete(ent_id);

            } else if (ent_type_str === 'face_edges') {
                scene.unselectObjGroup(ent_id, this.container, 'face_edges');
                const children = this.dataService.selected_face_edges.get(ent_id);
                children.forEach(c => {
                    this.dataService.selected_ents.get(EEntTypeStr[EEntType.EDGE]).delete(c);
                });
                this.dataService.selected_face_edges.delete(ent_id);

            } else if (ent_type_str === 'face_wires') {
                scene.unselectObjGroup(ent_id, this.container, 'face_wires');
                const children = this.dataService.selected_face_wires.get(ent_id);
                children.forEach(c => {
                    this.dataService.selected_ents.get(EEntTypeStr[EEntType.WIRE]).delete(c);
                });
                this.dataService.selected_face_wires.delete(ent_id);
            }
        } else {
            scene.unselectObj(ent_id, this.container);
            this.dataService.selected_ents.get(ent_type_str).delete(ent_id);
            this.unselectLabel(ent_id, ent_type_str);
        }
        this.refreshTable(event);
    }

    private unselectLabel(ent_id, ent_type_str) {
        let arr = Array.from(this.dataService.selected_ents.get(ent_type_str).values());
        arr = arr.filter(item => {
            return item !== Number(ent_id.substr(2));
        });
        this.refreshLabels(ent_type_str);
    }

    private selectEdge(line: number) {
        const ent_type_str = EEntTypeStr[EEntType.EDGE],
            verts = this.model.geom.nav.navEdgeToVert(line),
            positions = verts.map(v => this.model.attribs.query.getVertCoords(v)),
            posi_flat = [].concat(...positions),
            ent_id = `${ent_type_str}${line}`;
        this.dataService.selected_ents.get(ent_type_str).set(ent_id, line);
        const labelText = this.indexAsLabel(ent_type_str, ent_id, line, EEntType.EDGE);
        this._data_threejs.selectObjLine(ent_id, [], posi_flat, this.container, labelText);
    }

    private selectEdgeByFace(face: number, parent_ent_id: string) {
        const ent_type_str = EEntTypeStr[EEntType.EDGE],
            edges = this.model.geom.nav.navAnyToAny(EEntType.FACE, EEntType.EDGE, face);
        const children = [];
        edges.map(edge => {
            const ent_id = `${ent_type_str}${edge}`;
            children.push(ent_id);
            const vert = this.model.geom.nav.navEdgeToVert(edge);
            const position = [];
            const indices = [];
            vert.map((v, i) => {
                position.push(this.model.attribs.query.getVertCoords(v));
                indices.push(i);
            });
            const posi_flat = [].concat(...position);
            this.dataService.selected_ents.get(ent_type_str).set(ent_id, edge);
            const labelText = this.indexAsLabel(ent_type_str, ent_id, edge, EEntType.EDGE);
            this._data_threejs.selectEdgeByFace(parent_ent_id, ent_id, indices, posi_flat, this.container, labelText);
        });
        this.dataService.selected_face_edges.set(`${parent_ent_id}`, children);
    }

    private selectWire(wire: number) {
        const ent_type_str = EEntTypeStr[EEntType.WIRE],
            edges = this.model.geom.nav.navWireToEdge(wire),
            verts = edges.map(e => this.model.geom.nav.navEdgeToVert(e)),
            verts_flat = [].concat(...[].concat(...verts)),
            indices = [],
            positions = [];
        verts_flat.map((v, i) => {
            positions.push(this.model.attribs.query.getVertCoords(v));
            indices.push(i);
        });
        const posi_flat = [].concat(...positions),
            ent_id = `${ent_type_str}${wire}`;
        this.dataService.selected_ents.get(ent_type_str).set(ent_id, wire);
        const labelText = this.indexAsLabel(ent_type_str, ent_id, wire, EEntType.WIRE);
        this._data_threejs.selectObjLine(ent_id, indices, posi_flat, this.container, labelText);
    }

    private selectWireByFace(face: number, parent_ent_id: string) {
        const ent_type_str = EEntTypeStr[EEntType.WIRE],
            wires = this.model.geom.nav.navFaceToWire(face);
        const children = [];
        wires.map(wire => {
            const ent_id = `${ent_type_str}${wire}`;
            children.push(ent_id);
            const edges = this.model.geom.nav.navWireToEdge(wire),
                verts = edges.map(e => this.model.geom.nav.navEdgeToVert(e));
            // @ts-ignore
            const verts_flat = verts.flat(1),
                indices = [],
                positions = [];
            verts_flat.map((v, i) => {
                positions.push(this.model.attribs.query.getVertCoords(v));
                indices.push(i);
            });
            const posi_flat = [].concat(...positions);
            this.dataService.selected_ents.get(ent_type_str).set(ent_id, wire);
            const labelText = this.indexAsLabel(ent_type_str, ent_id, wire, EEntType.WIRE);
            this._data_threejs.selectWireByFace(parent_ent_id, ent_id, indices, posi_flat, this.container, labelText);
        });
        this.dataService.selected_face_wires.set(`${parent_ent_id}`, children);
    }

    private selectFace(face: number) {
        const ent_type_str = EEntTypeStr[EEntType.FACE],
            tri = this.model.geom.nav.navFaceToTri(face),
            verts = tri.map(index => this.model.geom.nav.navTriToVert(index)),
            verts_flat = [].concat(...verts),
            posis = verts_flat.map(v => this.model.geom.nav.navAnyToPosi(EEntType.VERT, v)),
            posis_flat = [].concat(...posis),
            tri_indices = [],
            positions = [];
        posis_flat.map((posi, index) => {
            positions.push(this.model.attribs.query.getPosiCoords(posi));
            tri_indices.push(index);
        });
        const posi_flat = [].concat(...positions),
            ent_id = `${ent_type_str}${face}`;
        this.dataService.selected_ents.get(ent_type_str).set(ent_id, face);
        const labelText = this.indexAsLabel(ent_type_str, ent_id, face, EEntType.FACE);
        this._data_threejs.selectObjFace(ent_id, tri_indices, posi_flat, this.container, labelText);
    }

    private indexAsLabel(ent_type_str: string, ent_id: string, id: number, type: EEntType) {
        let indexAsLabel;
        const showSelected = JSON.parse(sessionStorage.getItem('mpm_showSelected'));
        if (showSelected) {
            const sorted = sortByKey(this.dataService.selected_ents.get(ent_type_str));
            const arr = Array.from(sorted.values());
            indexAsLabel = String(arr.findIndex(ent => ent === id));
        } else {
            indexAsLabel = ent_id;
            // indexAsLabel = String(this._data_threejs._model.attribs.threejs.getIdIndex(type, id));
        }
        return indexAsLabel;
    }

    private selectPoint(point: number) {
        const ent_type_str = EEntTypeStr[EEntType.POINT];
        const result = this.getPointPosis(point, null);
        if (result) {
            const point_indices = result.point_indices;
            const point_posi = result.posi_flat;
            const ent_id = `${ent_type_str}${point}`;
            this.dataService.selected_ents.get(ent_type_str).set(ent_id, point);
            const labelText = this.indexAsLabel(ent_type_str, ent_id, point, EEntType.POINT);
            this._data_threejs.selectObjPoint(ent_id, point_indices, point_posi, this.container, labelText);
        }
    }

    private selectPLine(pline: number) {
        const ent_type_str = EEntTypeStr[EEntType.PLINE];
        const result = this.getPLinePosis(pline);
        const ent_id = `${ent_type_str}${pline}`;
        if (result) {
            const posi_flat = result.posi_flat;
            const indices = result.indices;
            this.dataService.selected_ents.get(ent_type_str).set(ent_id, pline);
            const labelText = this.indexAsLabel(ent_type_str, ent_id, pline, EEntType.PLINE);
            this._data_threejs.selectObjLine(ent_id, indices, posi_flat, this.container, labelText);
        } else {
            this.showMessages('Please Select a Polyline', 'custom');
        }
    }

    private selectPGon(face: number) {
        const ent_type_str = EEntTypeStr[EEntType.PGON];
        const result = this.getPGonPosis(face);
        if (result) {
            const posi_flat = result.posi_flat;
            const tri_indices = result.indices;

            const ent_id = `${ent_type_str}${face}`;
            this.dataService.selected_ents.get(ent_type_str).set(ent_id, face);
            const labelText = this.indexAsLabel(ent_type_str, ent_id, face, EEntType.PGON);
            this._data_threejs.selectObjFace(ent_id, tri_indices, posi_flat, this.container, labelText);
        }
    }

    /**
     * get point positions for collections
     * @param points
     */

    private getPointPosis(point1: number = null, points: number[] = null) {
        let verts_flat: number[] = null;
        if (point1 !== null) {
            verts_flat = [this.model.geom.nav.navPointToVert(point1)];
        }
        if (points !== null) {
            const verts = points.map(p => this.model.geom.nav.navPointToVert(p));
            verts_flat = [].concat(...verts);
        }

        const point_indices: number[] = [];
        const positions: Txyz[] = [];
        verts_flat.map((v, i) => {
            positions.push(this.model.attribs.query.getPosiCoords(v));
            point_indices.push(i);
        });
        const posi_flat = [].concat(...positions);
        const result = { posi_flat, point_indices };
        return result;
    }

    /**
     * get pline positions for selectPLine or collections
     * @param wire1
     * @param plines
     */

    private getPLinePosis(pline1: number = null, plines: number[] = null) {
        let wires_flat: number[] = null;
        if (pline1 !== null) {
            wires_flat = [this.model.geom.nav.navPlineToWire(pline1)];
        }
        if (plines !== null) {
            const wires = plines.map(pl => this.model.geom.nav.navPlineToWire(pl));
            wires_flat = [].concat(...wires);
        }

        const edges = wires_flat.map(w => this.model.geom.nav.navWireToEdge(w));
        const edges_flat = [].concat(...edges);
        const verts = edges_flat.map(e => this.model.geom.nav.navEdgeToVert(e));
        const verts_flat = [].concat(...[].concat(...verts));
        const indices = [];
        const positions = [];
        verts_flat.map((v, i) => {
            positions.push(this.model.attribs.query.getVertCoords(v));
            indices.push(i);
        });
        const posi_flat = [].concat(...positions);
        const result = { posi_flat, indices };
        return result;
    }

    /**
     * get pgon positions for selectPGon or collections
     * @param face1
     * @param pgons
     */

    private getPGonPosis(face1: number = null, pgons: number[] = null) {
        let faces_flat: number[] = null;
        if (face1 !== null) {
            const _pgon = this.model.geom.nav.navFaceToPgon(face1);
            if (_pgon === undefined) {
                return null;
            }
            faces_flat = [this.model.geom.nav.navPgonToFace(_pgon)];
        }
        if (pgons !== null) {
            const faces = pgons.map(pgon => this.model.geom.nav.navPgonToFace(pgon));
            faces_flat = [].concat(...faces);
        }
        const tris = faces_flat.map(face => this.model.geom.nav.navFaceToTri(face));
        const tris_flat = [].concat(...tris);
        const verts = tris_flat.map(tri => this.model.geom.nav.navTriToVert(tri));
        const verts_flat = [].concat(...verts);
        const posis = verts_flat.map(v => this.model.geom.nav.navAnyToPosi(EEntType.VERT, v));
        const posis_flat = [].concat(...posis);
        const indices = [];
        const positions = [];
        posis_flat.map((posi, index) => {
            positions.push(this.model.attribs.query.getPosiCoords(posi));
            indices.push(index);
        });
        const posi_flat = [].concat(...positions);
        const result = { posi_flat, indices };
        return result;
    }

    private selectColl(object: THREE.Intersection, type) {
        let colls = [];
        if (type === 'Mesh') {
            colls = this.model.geom.nav.navAnyToColl(EEntType.TRI, object.faceIndex);
        } else if (type === 'LineSegments') {
            colls = this.model.geom.nav.navAnyToColl(EEntType.EDGE, object.index / 2);
        } else if (type === 'Points') {
            const vert = this.model.geom.nav.navPosiToVert(object.index);
            const point = this.model.geom.nav.navVertToPoint(vert[0]);
            colls = this.model.geom.nav.navAnyToColl(EEntType.POINT, point);
        }
        /**
         * Show dropdown menu only when Entity belongs to more than 1 Collection.
         */
        if (this.dataService.selected_ents.get(EEntTypeStr[EEntType.COLL]).size === 0 && colls.length > 1) {
            this.dropdown.setItems(colls, 'co');
            this.dropdown.visible = true;
            this.dropdown.position = this.dropdownPosition;
        } else if (colls && colls.length === 1) {
            this.chooseColl(colls[0]);
        } else {
            this.showMessages('No Collections Available', 'custom');
        }
    }

    private chooseColl(id: number) {
        const scene = this._data_threejs;
        const coll_id = `${EEntTypeStr[EEntType.COLL]}${id}`;
        const children = [];
        const pgons = this.model.geom.nav.navCollToPgon(id);
        const pgons_flat = [].concat(...pgons);

        if (pgons_flat.length) {
            const pgonResult = this.getPGonPosis(null, pgons_flat);
            const pgons_posi = pgonResult.posi_flat;
            const pgons_indices = pgonResult.indices;

            if (pgons_indices.length !== 0) {
                // const attrib_val = this.model.attribs.query.getAttribValue(EEntType.COLL, EAttribNames.NAME, id);
                // const selecting = attrib_val ? attrib_val.toString() : `${EEntType.COLL}${id}`;
                const pgon_id = `${EEntTypeStr[EEntType.COLL]}_pg_${id}`;
                scene.selectObjFace(pgon_id, pgons_indices, pgons_posi, this.container, false);
                children.push(pgon_id);
            }
        }

        const plines = this.model.geom.nav.navCollToPline(id);
        const plines_flat = [].concat(...plines);
        if (plines_flat.length) {
            const plineResult = this.getPLinePosis(null, plines_flat);
            const plines_posi = plineResult.posi_flat;
            const plines_indices = plineResult.indices;
            if (plines_indices.length !== 0) {
                const pline_id = `${EEntTypeStr[EEntType.COLL]}_pl_${id}`;
                scene.selectObjLine(pline_id, plines_indices, plines_posi, this.container, false);
                children.push(pline_id);
            }
        }

        const points = this.model.geom.nav.navCollToPoint(id);
        const points_flat = [].concat(...points);
        if (points_flat.length) {
            const pointResult = this.getPointPosis(null, points_flat);
            const point_posi = pointResult.posi_flat;
            const point_indices = pointResult.point_indices;
            if (point_indices.length !== 0) {
                const point_id = `${EEntTypeStr[EEntType.COLL]}_pt_${id}`;
                scene.selectObjPoint(point_id, point_indices, point_posi, this.container, false);
                children.push(point_id);
            }
        }

        this.dataService.selected_ents.get(EEntTypeStr[EEntType.COLL]).set(coll_id, id);
        this.dataService.selected_coll.set(coll_id, children);
        this.refreshTable(null);
    }

    private chooseVertex(id: number) {
        const ent_type_str = EEntTypeStr[EEntType.VERT];
        const posi_ent = this.dataService.selected_ents.get(ent_type_str);
        const scene = this._data_threejs;
        const date = new Date(), timestamp = date.getTime();
        const position = this.model.attribs.query.getVertCoords(id);
        const ent_id = `${ent_type_str}${id}`;
        const labelText = this.indexAsLabel(ent_type_str, ent_id, id, EEntType.VERT);
        scene.selectObjvertex(`_single_v${timestamp}`, ent_id, position, this.container, labelText);
        posi_ent.set(ent_id, id);
        this.dataService.selected_vertex.set(`_single_v${timestamp}`, [ent_id]);
        this.refreshTable(null);
    }

    public zoomfit() {
        // if (JSON.stringify(this._data_threejs._threejs_nums) === JSON.stringify([0, 0, 0])) {
        //     return;
        // }
        this._data_threejs.lookAtObj();
    }

    private EntTypeToStr(ent_type: EEntType) {
        return EEntTypeStr[ent_type];
    }

    private selectEntityType(selection: { id: number, name: string }) {
        this.SelectingEntityType = selection;
        localStorage.setItem('mpm_selecting_entity_type', JSON.stringify(selection));

        const settings = JSON.parse(localStorage.getItem('mpm_settings'));
        if (settings !== undefined && selection) {
            settings.select.selector = selection;
            localStorage.setItem('mpm_settings', JSON.stringify(settings));
        }
        this.selectDropdownVisible = false;
    }

    selectEntity(id: number) {
        if (this.SelectingEntityType.id === EEntType.COLL) {
            this.chooseColl(id);
        } else if (this.SelectingEntityType.id === EEntType.VERT) {
            this.chooseVertex(id);
        }
    }

}

enum mouseLabel {
    Mesh = 'Polygon',
    LineSegments = 'Polyline/',
    Points = 'Point/Position'
}
