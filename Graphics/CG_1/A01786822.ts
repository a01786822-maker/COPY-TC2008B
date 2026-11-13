/*
 * Script to draw a 2D smiley face made of triangles
 * Objective 4: drop-down menu to change the order of the transformations
 *
 * Ariel Pulver 
 * A01786822
 */

'use strict';

import * as twgl from 'twgl-base.js';
import GUI from 'lil-gui';
import { diamond } from '../libs/shapes.js';
import { V2, M3, type Mat3 } from '../libs/2d-lib.js';

// Import the shaders from external files
import vsGLSL from './vs_face.glsl?raw';
import fsGLSL from './fs_face.glsl?raw';

// Types for the values controlled by the user interface
type FaceSettings = {
    x: number,
    y: number,
    rotation: number,
    scaleX: number,
    scaleY: number,
    order: string,
};
type PivotSettings = {
    x: number,
    y: number,
};


// Create the data for a face made of triangles
function face(radius: number): twgl.Arrays {
    const positionData: number[] = [];
    const colorData: number[] = [];
    const indexData: number[] = [];

    // Head: a vertex in the center and a ring of vertices around it
    const sides = 20;
    positionData.push(0, 0);
    colorData.push(1, 0.95, 0.3, 1);
    for (let i = 0; i < sides; i++) {
        const angle = 2 * Math.PI * i / sides;
        positionData.push(radius * Math.cos(angle), radius * Math.sin(angle));
        colorData.push(1, 0.95, 0.3, 1);
    }
    // Each triangle uses the center and two vertices of the ring
    for (let i = 1; i <= sides; i++) {
        const next = (i % sides) + 1;
        indexData.push(0, i, next);
    }

    // Left eye (index 21, 22, 23)
    positionData.push(-60, 60);
    positionData.push(-30, 60);
    positionData.push(-45, 30);
    // Right eye (index 24, 25, 26)
    positionData.push(30, 60);
    positionData.push(60, 60);
    positionData.push(45, 30);
    // Mouth (index 27, 28, 29)
    positionData.push(-60, -30);
    positionData.push(60, -30);
    positionData.push(0, -70);
    // The eyes and mouth are black
    for (let i = 0; i < 9; i++) {
        colorData.push(0, 0, 0, 1);
    }
    indexData.push(21, 22, 23);
    indexData.push(24, 25, 26);
    indexData.push(27, 28, 29);

    const arrays: twgl.Arrays = {
        a_position: { numComponents: 2, data: positionData },
        a_color:    { numComponents: 4, data: colorData },
        indices:    { numComponents: 3, data: indexData },
    };

    return arrays;
}

function main(): void {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        throw new Error('No canvas element found in the document');
    }

    const gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL2 is not supported by this browser');
    }

    twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);

    const programInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

    // Data for the face, with its own buffer and VAO
    const faceArrays = face(150);
    const faceBufferInfo = twgl.createBufferInfoFromArrays(gl, faceArrays);
    const faceVao = twgl.createVAOFromBufferInfo(gl, programInfo, faceBufferInfo);

    // Data for the pivot, with its own buffer and VAO
    const pivotArrays = diamond(15);
    const pivotBufferInfo = twgl.createBufferInfoFromArrays(gl, pivotArrays);
    const pivotVao = twgl.createVAOFromBufferInfo(gl, programInfo, pivotBufferInfo);

    // Values controlled by the user interface
    const faceSettings: FaceSettings = {
        x: gl.canvas.width / 2,
        y: gl.canvas.height / 2,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        order: 'scale -> translation -> rotation',
    };
    const pivotSettings: PivotSettings = {
        x: gl.canvas.width / 4,
        y: gl.canvas.height / 2,
    };

    // Function to draw the scene again every time a value changes
    const redraw = () => {
        drawScene(gl, programInfo, faceVao, faceBufferInfo,
                  pivotVao, pivotBufferInfo, faceSettings, pivotSettings);
    };

    setupUI(gl, faceSettings, pivotSettings, redraw);

    redraw();
}

// Function to create the controls
function setupUI(
    gl: WebGL2RenderingContext,
    faceSettings: FaceSettings,
    pivotSettings: PivotSettings,
    redraw: () => void,
): void {
    const gui = new GUI();

    const faceFolder = gui.addFolder('Face');

    const traFolder = faceFolder.addFolder('Translation');
    traFolder.add(faceSettings, 'x', 0, gl.canvas.width).onChange(redraw);
    traFolder.add(faceSettings, 'y', 0, gl.canvas.height).onChange(redraw);

    const rotFolder = faceFolder.addFolder('Rotation');
    rotFolder.add(faceSettings, 'rotation', 0, Math.PI * 2).onChange(redraw);

    const scaFolder = faceFolder.addFolder('Scale');
    scaFolder.add(faceSettings, 'scaleX', -5, 5).onChange(redraw);
    scaFolder.add(faceSettings, 'scaleY', -5, 5).onChange(redraw);

    const pivotFolder = gui.addFolder('Pivot');
    const pivotTraFolder = pivotFolder.addFolder('Translation');
    pivotTraFolder.add(pivotSettings, 'x', 0, gl.canvas.width).onChange(redraw);
    pivotTraFolder.add(pivotSettings, 'y', 0, gl.canvas.height).onChange(redraw);

    // Drop-down menu to change the order of the transformations
    gui.add(faceSettings, 'order', [
        'scale -> rotation -> translation',
        'scale -> translation -> rotation',
        'translation -> scale -> rotation',
        'rotation -> translation -> scale',
        'rotation -> scale -> translation',
    ]).name('Order').onChange(redraw);
}

// Function to draw one object with its own transformation matrix
function drawObject(
    gl: WebGL2RenderingContext,
    programInfo: twgl.ProgramInfo,
    vao: WebGLVertexArrayObject,
    bufferInfo: twgl.BufferInfo,
    transforms: Mat3,
): void {
    let uniforms =
    {
        u_resolution: [gl.canvas.width, gl.canvas.height],
        u_transforms: transforms,
    }

    twgl.setUniforms(programInfo, uniforms);

    gl.bindVertexArray(vao);

    twgl.drawBufferInfo(gl, bufferInfo);
}

// Function to do the actual display of the objects
function drawScene(
    gl: WebGL2RenderingContext,
    programInfo: twgl.ProgramInfo,
    faceVao: WebGLVertexArrayObject,
    faceBufferInfo: twgl.BufferInfo,
    pivotVao: WebGLVertexArrayObject,
    pivotBufferInfo: twgl.BufferInfo,
    faceSettings: FaceSettings,
    pivotSettings: PivotSettings,
): void {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    // Vectors for the transformations
    const v2_trans = V2.create(faceSettings.x, faceSettings.y);
    const v2_scale = V2.create(faceSettings.scaleX, faceSettings.scaleY);
    // Vector to translate the pivot to the origin
    const v2_pivot_to_center = V2.create(-pivotSettings.x, -pivotSettings.y);
    // Vector to translate the pivot back to its position
    const v2_center_to_pivot = V2.create(pivotSettings.x, pivotSettings.y);

    // Transform matrices for the face
    const scaleMatrix: Mat3 = M3.scale(v2_scale);
    const translateMatrix: Mat3 = M3.translation(v2_trans);
    const pivotToCenter: Mat3 = M3.translation(v2_pivot_to_center);
    const centerToPivot: Mat3 = M3.translation(v2_center_to_pivot);
    const rotateMatrix: Mat3 = M3.rotation(faceSettings.rotation);

    // Rotation around the pivot
    let rotationMatrix: Mat3 = M3.identity();
    rotationMatrix = M3.multiply(pivotToCenter, rotationMatrix);
    rotationMatrix = M3.multiply(rotateMatrix, rotationMatrix);
    rotationMatrix = M3.multiply(centerToPivot, rotationMatrix);

    // Create a composite transform matrix, in the order selected in the menu
    let faceTransforms: Mat3 = M3.identity();
    switch (faceSettings.order) {
        case 'scale -> rotation -> translation':
            faceTransforms = M3.multiply(scaleMatrix, faceTransforms);
            faceTransforms = M3.multiply(rotationMatrix, faceTransforms);
            faceTransforms = M3.multiply(translateMatrix, faceTransforms);
            break;
        case 'scale -> translation -> rotation':
            faceTransforms = M3.multiply(scaleMatrix, faceTransforms);
            faceTransforms = M3.multiply(translateMatrix, faceTransforms);
            faceTransforms = M3.multiply(rotationMatrix, faceTransforms);
            break;
        case 'translation -> scale -> rotation':
            faceTransforms = M3.multiply(translateMatrix, faceTransforms);
            faceTransforms = M3.multiply(scaleMatrix, faceTransforms);
            faceTransforms = M3.multiply(rotationMatrix, faceTransforms);
            break;
        case 'rotation -> translation -> scale':
            faceTransforms = M3.multiply(rotationMatrix, faceTransforms);
            faceTransforms = M3.multiply(translateMatrix, faceTransforms);
            faceTransforms = M3.multiply(scaleMatrix, faceTransforms);
            break;
        case 'rotation -> scale -> translation':
            faceTransforms = M3.multiply(rotationMatrix, faceTransforms);
            faceTransforms = M3.multiply(scaleMatrix, faceTransforms);
            faceTransforms = M3.multiply(translateMatrix, faceTransforms);
            break;
    }
    drawObject(gl, programInfo, faceVao, faceBufferInfo, faceTransforms);

    // The pivot only has a translation
    const pivotTransforms: Mat3 = M3.multiply(centerToPivot, M3.identity());
    drawObject(gl, programInfo, pivotVao, pivotBufferInfo, pivotTransforms);
}

main()