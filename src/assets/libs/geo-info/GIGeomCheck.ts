import { IGeomArrays, TVert, TWire, TColl, TPline, TEdge, TFace, TPgon, TPoint } from './common';
import { GIGeom } from './GIGeom';


/**
 * Class for geometry.
 */
export class GIGeomCheck {
    private _geom: GIGeom;
    private _geom_arrays: IGeomArrays;
    /**
     * Constructor
     */
    constructor(geom: GIGeom, geom_arrays: IGeomArrays) {
        this._geom = geom;
        this._geom_arrays = geom_arrays;
    }
    /**
     * Checks geometry for internal consistency
     */
    public check(): string[] {
        const errors: string[] = [];
        this._checkPosis().forEach( error => errors.push(error) );
        this._checkVerts().forEach( error => errors.push(error) );
        this._checkEdges().forEach( error => errors.push(error) );
        this._checkWires().forEach( error => errors.push(error) );
        this._checkFaces().forEach( error => errors.push(error) );
        this._checkPoints().forEach( error => errors.push(error) );
        this._checkPlines().forEach( error => errors.push(error) );
        this._checkPgons().forEach( error => errors.push(error) );
        this._checkEdgeOrder().forEach( error => errors.push(error) );
        return errors;
    }
    /**
     * Checks geometry for internal consistency
     */
    private _checkPosis(): string[] {
        const errors: string[] = [];
        for (let posi_i = 0; posi_i < this._geom_arrays.up_posis_verts.length; posi_i++) {
            // up
            const verts_i: number[] = this._geom_arrays.up_posis_verts[posi_i];
            if (verts_i === undefined) { errors.push('Posi ' + posi_i + ': Posi->Vert undefined.'); }
            if (verts_i === null) { continue; } // deleted
            // down
            for (const vert_i of verts_i) {
                const vert: TVert = this._geom_arrays.dn_verts_posis[vert_i];
                if (vert === undefined ) { errors.push('Posi ' + posi_i + ': Vert->Posi undefined.'); }
                if (vert === null ) { errors.push('Posi ' + posi_i + ': Vert->Posi null.'); }
            }
        }
        return errors;
    }
    private _checkVerts(): string[] {
        const errors: string[] = [];
        for (let vert_i = 0; vert_i < this._geom_arrays.dn_verts_posis.length; vert_i++) {
            // check the vert itself
            const vert: TVert = this._geom_arrays.dn_verts_posis[vert_i];
            if (vert === undefined) { errors.push('Vert ' + vert_i + ': Vert->Posi undefined.'); }
            if (vert === null) { continue; } // deleted
            // check the position
            const posi_i: number = vert;
            // check that the position points up to this vertex
            const verts_i: number[] = this._geom_arrays.up_posis_verts[posi_i];
            if (verts_i.indexOf(vert_i) === -1) {
                errors.push('Vert ' + vert_i + ': Posi->Vert index is missing.');
            }
            // check if the parent is a popint or edge
            const point_i: number = this._geom_arrays.up_verts_points[vert_i];
            const edges_i: number[] = this._geom_arrays.up_verts_edges[vert_i];
            if (point_i !== undefined && edges_i !== undefined) {
                errors.push('Vert ' + vert_i + ': Both Vert->Edge and Vert->Point.');
            }
            if (point_i !== undefined) {
                // up for points
                if (point_i === null) {
                    errors.push('Vert ' + vert_i + ': Vert->Point null.');
                    continue;
                }
                // down for points
                const point: TPoint = this._geom_arrays.dn_points_verts[point_i];
                if (point === undefined) {
                    errors.push('Vert ' + vert_i + ': Point->Vert undefined.');
                }
                if (point === null) {
                    errors.push('Vert ' + vert_i + ': Point->Vert null.');
                }
                // check this point points to this vertex
                if (point !== vert_i) {
                    errors.push('Vert ' + vert_i + ': Point->Vert index is incorrect.');
                }
            } else if (edges_i !== undefined) {
                // up for edges
                if (edges_i === null) {
                    errors.push('Vert ' + vert_i + ': Vert->Edge null.');
                    continue;
                }
                if (edges_i.length > 2) { errors.push('Vert ' + vert_i + ': Vert->Edge has more than two edges.'); }
                for (const edge_i of edges_i) {
                    if (edge_i === undefined) {
                        errors.push('Vert ' + vert_i + ': Vert->Edge undefined.');
                    }
                    if (edge_i === null) {
                        errors.push('Vert ' + vert_i + ': Vert->Edge null.');
                    }
                    // down for edges
                    const edge: TEdge = this._geom_arrays.dn_edges_verts[edge_i];
                    if (edge === undefined) {
                        errors.push('Vert ' + vert_i + ': Edge->Vert undefined.');
                    } else if (edge === null) {
                        errors.push('Vert ' + vert_i + ': Edge->Vert null.');
                    } else {
                        // check the egde points down to this vertex
                        if (edge.indexOf(vert_i) === -1) {
                            errors.push('Vert ' + vert_i + ': Edge->Vert index is missing.');
                        }
                    }
                }
            } else {
                errors.push('Vert ' + vert_i + ': Both Vert->Edge and Vert->Point undefined.');
            }
        }
        return errors;
    }
    private _checkEdges(): string[] {
        const errors: string[] = [];
        for (let edge_i = 0; edge_i < this._geom_arrays.dn_edges_verts.length; edge_i++) {
            // check the edge itself
            const edge: TEdge = this._geom_arrays.dn_edges_verts[edge_i];
            if (edge === undefined) { errors.push('Edge ' + edge_i + ': Edge->Vert undefined.'); }
            if (edge === null) { continue; } // deleted
            if (edge.length > 2) { errors.push('Edge ' + edge_i + ': Edge has more than two vertices.'); }
            // down from edge to vertices
            const verts_i: number[] = this._geom_arrays.dn_edges_verts[edge_i];
            for (const vert_i of verts_i)   {
                // check the vertex
                if (vert_i === undefined) {
                    errors.push('Edge ' + edge_i + ': Edge->Vert undefined.');
                } else if (vert_i === null) {
                    errors.push('Edge ' + edge_i + ': Edge->Vert null.');
                } else {
                    // check the vert points up to this edge
                    const vert_edges_i: number[] = this._geom_arrays.up_verts_edges[vert_i];
                    if (vert_edges_i.indexOf(edge_i) === -1) {
                        errors.push('Edge ' + edge_i + ': Vert->Edge index is missing.');
                    }
                }
            }
            // up from edge to wire
            const wire_i: number = this._geom_arrays.up_edges_wires[edge_i];
            if (wire_i === undefined) { continue; } // no wire, must be a point
            if (wire_i === null) { errors.push('Edge ' + edge_i + ': Edge->Wire null.'); }
            // check the wire
            const wire: TWire = this._geom_arrays.dn_wires_edges[wire_i];
            if (wire === undefined) {
                errors.push('Edge ' + edge_i + ': Wire->Edge undefined.');
            } else if (wire === null) {
                errors.push('Edge ' + edge_i + ': Wire->Edge null.');
            } else {
                // check the wire points down to this edge
                if (wire.indexOf(edge_i) === -1) {
                    errors.push('Edge ' + edge_i + ': Wire->Edge index is missing.');
                }
            }
        }
        return errors;
    }
    private _checkWires(): string[] {
        const errors: string[] = [];
        for (let wire_i = 0; wire_i < this._geom_arrays.dn_wires_edges.length; wire_i++) {
            // check the wire itself
            const wire: TWire = this._geom_arrays.dn_wires_edges[wire_i];
            if (wire === undefined) { errors.push('Wire ' + wire_i + ': Wire->Edge undefined.'); }
            if (wire === null) { continue; } // deleted
            // down from wire to edges
            const edges_i: number[] = wire;
            for (const edge_i of edges_i) {
                // check the edge
                if (edge_i === undefined) {
                    errors.push('Wire ' + wire_i + ': Wire->Edge undefined.');
                } else if (edge_i === null) {
                    errors.push('Wire ' + wire_i + ': Wire->Edge null.');
                } else {
                    // check the edge points up to this wire
                    const edge_wire_i: number = this._geom_arrays.up_edges_wires[edge_i];
                    if (edge_wire_i !== wire_i) {
                        errors.push('Wire ' + wire_i + ': Edge->Wire index is incorrect.');
                    }
                }
            }
            // up from wire to face or pline
            const face_i: number = this._geom_arrays.up_wires_faces[wire_i];
            const pline_i: number = this._geom_arrays.up_wires_plines[wire_i];
            if (face_i !== undefined && pline_i !== undefined) {
                // errors.push('Wire ' + wire_i + ': Both Wire->Face and Wire->Pline.');
            }
            if (face_i !== undefined) {
                if (face_i === null) {
                    errors.push('Wire ' + wire_i + ': Wire->Face null.');
                }
                // down from face to wires (and tris)
                const face: TFace = this._geom_arrays.dn_faces_wirestris[face_i];
                if (face === undefined) {
                    errors.push('Wire ' + wire_i + ': Face->Wire undefined.');
                } else if (face === null) {
                    errors.push('Wire ' + wire_i + ': Face->Wire null.');
                } else {
                    // check that this face points down to the wire
                    if (face[0].indexOf(wire_i) === -1) {
                        errors.push('Wire ' + wire_i + ': Face->Wire index is missing.');
                    }
                }
            } else if (pline_i !== undefined) {
                if (pline_i === null) {
                    errors.push('Wire ' + wire_i + ': Wire->Pline null.');
                }
                // down from pline to wire
                const pline: TPline = this._geom_arrays.dn_plines_wires[pline_i];
                if (pline === undefined) {
                    errors.push('Wire ' + wire_i + ': Pline->Wire undefined.');
                } else if (pline === null) {
                    errors.push('Wire ' + wire_i + ': Pline->Wire null.');
                } else {
                    // check that this pline points down to the wire
                    if (pline !== wire_i) {
                        errors.push('Wire ' + wire_i + ': Pline->Wire index is incorrect.');
                    }
                }
            } else {
                errors.push('Wire ' + wire_i + ': Both Wire->Face and Wire->Pline undefined.');
            }
        }
        return errors;
    }
    private _checkFaces(): string[] {
        const errors: string[] = [];
        for (let face_i = 0; face_i < this._geom_arrays.dn_faces_wirestris.length; face_i++) {
            // check this face itself
            const face: TFace = this._geom_arrays.dn_faces_wirestris[face_i];
            if (face === undefined) { errors.push('Face ' + face_i + ': Face->WireTri undefined.'); }
            if (face === null) { continue; } // deleted
            // down from face to wires
            const wires_i: number[] = face[0];
            for (const wire_i of wires_i) {
                // check the wire
                if (wire_i === undefined) {
                    errors.push('Face ' + face_i + ': Face->Wire undefined.');
                } else if (wire_i === null) {
                    errors.push('Face ' + face_i + ': Face->Wire null.');
                } else {
                    // check the wire points up to this face
                    const wire_face_i: number = this._geom_arrays.up_wires_faces[wire_i];
                    if (wire_face_i !== face_i) {
                        errors.push('Face ' + face_i + ': Wire->Face index is incorrect.');
                    }
                }
            }
            // down from face to triangles
            const tris_i: number[] = face[1];
            for (const tri_i of tris_i) {
                // check the wire
                if (tri_i === undefined) {
                    errors.push('Face ' + face_i + ': Face->Tri undefined.');
                } else if (tri_i === null) {
                    errors.push('Face ' + face_i + ': Face->Tri null.');
                } else {
                    // check the tri points up to this face
                    const tri_face_i: number = this._geom_arrays.up_tris_faces[tri_i];
                    if (tri_face_i !== face_i) {
                        errors.push('Face ' + face_i + ': Tri->Face index is incorrect.');
                    }
                }
            }
            // up from face to pgon
            const pgon_i: number = this._geom_arrays.up_faces_pgons[face_i];
            if (pgon_i === undefined) {
                errors.push('Face ' + face_i + ': Face->Pgon undefined.');
            } else if (pgon_i === null) {
                errors.push('Face ' + face_i + ': Face->Pgon null.');
            }
            // down from pgon to face
            const pgon: TPgon = this._geom_arrays.dn_pgons_faces[pgon_i];
            if (pgon === undefined) {
                errors.push('Face ' + face_i + ': Pgon->Face undefined.');
            } else if (pgon === null) {
                errors.push('Face ' + face_i + ': Pgon->Face null.');
            } else {
                // check that this pgon points down to this face
                if (pgon !== face_i) {
                    errors.push('Face ' + face_i + ': Pgon->Face index is incorrect.');
                }
            }
        }
        return errors;
    }
    private _checkPoints(): string[] {
        const errors: string[] = [];
        for (let point_i = 0; point_i < this._geom_arrays.dn_points_verts.length; point_i++) {
            // check the point itself
            const point: TPoint = this._geom_arrays.dn_points_verts[point_i];
            if (point === undefined) { errors.push('Point ' + point_i + ': Point->Vert undefined.'); }
            if (point === null) { continue; } // deleted
            // down from point to vertex
            const vert_i: number = point;
            // check that the vertex points up to this point
            const vertex_point_i: number = this._geom_arrays.up_verts_points[vert_i];
            if (vertex_point_i !== point_i) {
                errors.push('Point ' + point_i + ': Vertex->Point index is incorrect.');
            }
            // up from point to coll
            const colls_i: number[] = this._geom_arrays.up_points_colls[point_i];
            if (colls_i === undefined) { continue; } // not in coll
            for (const coll_i of colls_i) {
                if (coll_i === undefined) {
                    errors.push('Point ' + point_i + ': Point->Coll undefined.');
                }
                if (coll_i === null) {
                    errors.push('Point ' + point_i + ': Point->Coll null.');
                }
                // down from coll to points
                const coll: TColl = this._geom_arrays.dn_colls_objs[coll_i];
                if (coll === undefined) { errors.push('Point ' + point_i + ': Coll->Objs undefined.'); }
                if (coll === null) { errors.push('Point ' + point_i + ': Coll->Objs null.'); }
                if (coll[1].indexOf(point_i) === -1) {
                    errors.push('Point ' + point_i + ': Coll->Point missing.');
                }
            }
        }
        return errors;
    }
    private _checkPlines(): string[] {
        const errors: string[] = [];
        for (let pline_i = 0; pline_i < this._geom_arrays.dn_plines_wires.length; pline_i++) {
            // check the pline itself
            const pline: TPline = this._geom_arrays.dn_plines_wires[pline_i];
            if (pline === undefined) { errors.push('Pline ' + pline_i + ': Pline->Wire undefined.'); }
            if (pline === null) { continue; } // deleted
            // down from pline to wire
            const wire_i: number = pline;
            // check that the wire points up to this pline
            const wire_pline_i: number = this._geom_arrays.up_wires_plines[wire_i];
            if (wire_pline_i !== pline_i) {
                errors.push('Pline ' + pline_i + ': Wire->Pline index is incorrect.');
            }
            // up from pline to coll
            const colls_i: number[] = this._geom_arrays.up_plines_colls[pline_i];
            if (colls_i === undefined) { continue; } // not in coll
            for (const coll_i of colls_i) {
                if (coll_i === undefined) {
                    errors.push('Pline ' + pline_i + ': Pline->Coll undefined.');
                }
                if (coll_i === null) {
                    errors.push('Pline ' + pline_i + ': Pline->Coll null.');
                }
                // down from coll to plines
                const coll: TColl = this._geom_arrays.dn_colls_objs[coll_i];
                if (coll === undefined) { errors.push('Pline ' + pline_i + ': Coll->Objs undefined.'); }
                if (coll === null) { errors.push('Pline ' + pline_i + ': Coll->Objs null.'); }
                if (coll[2].indexOf(pline_i) === -1) {
                    errors.push('Pline ' + pline_i + ': Coll->Pline missing.');
                }
            }
        }
        return errors;
    }
    private _checkPgons(): string[] {
        const errors: string[] = [];
        for (let pgon_i = 0; pgon_i < this._geom_arrays.dn_pgons_faces.length; pgon_i++) {
            // check the pgon itself
            const pgon: TPgon = this._geom_arrays.dn_pgons_faces[pgon_i];
            if (pgon === undefined) { errors.push('Pgon ' + pgon_i + ': Pgon->Face undefined.'); }
            if (pgon === null) { continue; } // deleted
            // down from pgon to face
            const face_i: number = pgon;
            // check that the face points up to this pgon
            const face_pgon_i: number = this._geom_arrays.up_faces_pgons[face_i];
            if (face_pgon_i !== pgon_i) {
                errors.push('Pgon ' + pgon_i + ': Face->Pgon index is incorrect.');
            }
            // up from pgon to coll
            const colls_i: number[] = this._geom_arrays.up_pgons_colls[pgon_i];
            if (colls_i === undefined) { continue; } // not in coll
            for (const coll_i of colls_i) {
                if (coll_i === undefined) {
                    errors.push('Pgon ' + pgon_i + ': Pgon->Coll undefined.');
                }
                if (coll_i === null) {
                    errors.push('Pgon ' + pgon_i + ': Pgon->Coll null.');
                }
                // down from coll to pgons
                const coll: TColl = this._geom_arrays.dn_colls_objs[coll_i];
                if (coll === undefined) { errors.push('Pgon ' + pgon_i + ': Coll->Objs undefined.'); }
                if (coll === null) { errors.push('Pgon ' + pgon_i + ': Coll->Objs null.'); }
                if (coll[3].indexOf(pgon_i) === -1) {
                    errors.push('Pgon ' + pgon_i + ': Coll->Pgon missing.');
                }
            }
        }
        return errors;
    }
    private _checkEdgeOrder(): string[] {
        const errors: string[] = [];
        for (let wire_i = 0; wire_i < this._geom_arrays.dn_wires_edges.length; wire_i++) {
            // down
            const wire: TWire = this._geom_arrays.dn_wires_edges[wire_i];
            if (wire === undefined) { continue; } // error, will be picked up by _checkWires()
            if (wire === null) { continue; } // deleted
            // check if this is closed or open
            const first_edge: TEdge = this._geom_arrays.dn_edges_verts[wire[0]];
            const first_vert_i: number = first_edge[0];
            const last_edge: TEdge = this._geom_arrays.dn_edges_verts[wire[wire.length - 1]];
            const last_vert_i: number = last_edge[1];
            const is_closed: boolean = (first_vert_i === last_vert_i);
            if (!is_closed) {
                if (this._geom_arrays.up_verts_edges[first_edge[0]].length !== 1) {
                    errors.push('Open wire ' + wire_i + ': First vertex does not have one edge.');
                }
                if (this._geom_arrays.up_verts_edges[last_edge[1]].length !== 1) {
                    errors.push('Open wire ' + wire_i + ': Last vertex does not have one edge.');
                }
            }
            // console.log("==== ==== ====")
            // console.log("WIRE i", wire_i, "WIRE", wire)
            // check the edges of each vertex
            for (const edge_i of wire) {
                const edge: TEdge = this._geom_arrays.dn_edges_verts[edge_i];
                const start_vert_i = edge[0];
                const end_vert_i = edge[1];
                // console.log("====")
                // console.log("EDGE i", edge_i, "EDGE", edge)
                // console.log("VERT START", start_vert_i)
                // console.log("VERT END", end_vert_i)
                let exp_num_edges_vert0 = 2;
                let exp_num_edges_vert1 = 2;
                let start_idx = 1;
                let end_idx = 0;
                if (!is_closed) {
                    if (edge_i === wire[0]) { // first edge
                        exp_num_edges_vert0 = 1;
                        start_idx = 0;
                    }
                    if (edge_i === wire[wire.length - 1]) { // last edge
                        exp_num_edges_vert1 = 1;
                        end_idx = 0;
                    }
                }
                // check the start vertex
                const start_vert_edges_i: number[] = this._geom_arrays.up_verts_edges[start_vert_i];
                // console.log("START VERT EDGES", start_vert_edges_i)
                if (start_vert_edges_i.length !== exp_num_edges_vert0 ) {
                    errors.push('Wire ' + wire_i + ' Edge ' + edge_i + ' Vert ' + start_vert_i +
                        ': Start vertex does not have correct number of edges.');
                }
                if (start_vert_edges_i[start_idx] !== edge_i) {
                    errors.push('Wire ' + wire_i + ' Edge ' + edge_i + ' Vert ' + start_vert_i +
                        ': Vertex edges are in the wrong order.');
                }
                // check the end vertex
                const end_vert_edges_i: number[] = this._geom_arrays.up_verts_edges[end_vert_i];
                // console.log("END VERT EDGES", end_vert_edges_i)
                if (end_vert_edges_i.length !== exp_num_edges_vert1 ) {
                    errors.push('Wire ' + wire_i + ' Edge ' + edge_i + ' Vert ' + start_vert_i +
                        ': End vertex does not have correct number of edges.');
                }
                if (end_vert_edges_i[end_idx] !== edge_i) {
                    errors.push('Wire ' + wire_i + ' Edge ' + edge_i + ' Vert ' + end_vert_i +
                        ': Vertex edges are in the wrong order.');
                }
            }
        }
        return errors;
    }
}
