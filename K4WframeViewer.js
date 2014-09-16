if (window.File && window.FileReader && window.FileList && window.Blob) {
} else {
	alert('Meh, Y U No File API this browser.');
	die();
}

var viewX = 1024;
var viewY = 848;

var frameSizeX = 512;
var frameSizeY = 424;
var frameSize = frameSizeX * frameSizeY * 3; // 8bit rgb, msb in red, lsb in green, blue is 0

var reader = new FileReader();
var loadCounter = 0;
reader.onload = function (e) {
	var frameDataView = new Uint8Array(reader.result);
	loadPixels(tex_depthRaw, gl.RGB, frameSizeX, frameSizeY, gl.UNSIGNED_BYTE, frameDataView, true);
	loadCounter++;
	convertDepth2float();
	advanceDepth();
}

var file;
var fileFrameCount = 0;
function handleFileSelect(evt) {
	file = evt.target.files[0];
	if (file != null) {
		fileFrameCount = Math.floor(file.size / frameSize);
	} else {
		fileFrameCount = 0;
	}
}

document.getElementById('fileselector').addEventListener('change', handleFileSelect, false);

var lastReadFrameIdx = 0;
var readErrorCounter = 0;
function read() {
	try {
		if (lastReadFrameIdx >= fileFrameCount) {
			lastReadFrameIdx = 0;
		}
		var idx = lastReadFrameIdx * frameSize;
		reader.readAsArrayBuffer(file.slice(idx, idx + frameSize));
	} catch (err) {
		readErrorCounter++;
	}
	lastReadFrameIdx++;
}

var animationFrameCounter = 0;
var lastFrameTime;

function main() {
	requestAnimationFrame(main);
	animationFrameCounter++;
	if (file != null) {
		if (lastFrameTime == null)
			lastFrameTime = Date.now();

		var before = Date.now();

		read();

		var after = Date.now();

		var readTime = after - before;
		var frameTime = after - lastFrameTime;
		framelength = 0;
		document.getElementById("frameInfo").innerHTML = "<ul><li>animationFrameCounter: " + animationFrameCounter + "</li><li>loadCounter: " + loadCounter + "</li><li>time: " + frameTime + "</li><li>readErrorCounter: " + readErrorCounter + " (" + Math.floor(10000 * readErrorCounter / loadCounter) / 100 + "%)</li></ul>";

		composite();

		lastFrameTime = after;
	}
}

// WebGL initialization

var c = document.getElementById("c");
try {
	gl = c.getContext("experimental-webgl");
} catch (e) {
}
if (!gl) {
	alert("Meh! Y u no support experimental WebGL !?!");
	die();
}
c.width = viewX;
c.height = viewY;

["OES_texture_float", "OES_standard_derivatives", "OES_texture_float_linear"].forEach(function (name) {
	try {
		ext = gl.getExtension(name);
	} catch (e) {
		alert(e);
	}
	if (!ext) {
		alert("Meh! Y u no " + name + " !?!");
		die();
	}
	ext = false;
});

// textures and framebuffers

function loadPixels(texture, format, w, h, type, pixels, flipY) {
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	flipY || gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
	gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, format, type, pixels);
}

function createTexture(w, h, filter, type, format, clamp, pixels) {
	var texture = gl.createTexture();
	loadPixels(texture, format, w, h, type, pixels, false);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
	if (clamp) {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}
	return texture;
}

function createTextureAndBind(w, h, filter, type, format, wrap, pixels, fbo) {
	var texture = createTexture(w, h, filter, type, format, wrap, pixels);
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	return texture;
}

var rawData = [];
var floatData = [];
for (var j = 0; j < 512; j++) {
	for (var i = 0; i < 512; i++) {
		floatData.push(i / 512, j / 512, 0);
		if (j < frameSizeY && i < frameSizeX)
			rawData.push(255, 127, 0);
	}
}

var tex_depthRaw = createTexture(512, frameSizeY, gl.NEAREST, gl.UNSIGNED_BYTE, gl.RGB, true, new Uint8Array(rawData));

var FBO_floatdepth = gl.createFramebuffer();
var tex_depthFloat = createTextureAndBind(512, 512, gl.LINEAR, gl.FLOAT, gl.RGB, false, new Float32Array(floatData), FBO_floatdepth);

var FBO_depthAdvanced = gl.createFramebuffer();
var tex_depthAdvanced = createTextureAndBind(512, 512, gl.LINEAR, gl.FLOAT, gl.RGB, false, new Float32Array(floatData), FBO_depthAdvanced);

var FBO_depthAdvancedHelper = gl.createFramebuffer();
var tex_depthAdvancedHelper = createTextureAndBind(512, 512, gl.LINEAR, gl.FLOAT, gl.RGB, false, new Float32Array(floatData), FBO_depthAdvancedHelper);

// shaders

function getShader(gl, id) {
	var shaderScript = document.getElementById(id);
	var str = "";
	var k = shaderScript.firstChild;
	while (k) {
		if (k.nodeType == 3)
			str += k.textContent;
		k = k.nextSibling;
	}

	var fsIncScript = document.getElementById("include");
	var incStr = "";
	k = fsIncScript.firstChild;
	while (k) {
		if (k.nodeType == 3)
			incStr += k.textContent;
		k = k.nextSibling;
	}

	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		str = incStr + str;
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex")
		shader = gl.createShader(gl.VERTEX_SHADER);
	else
		return null;
	gl.shaderSource(shader, str);
	gl.compileShader(shader);
	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0)
		alert("error compiling shader '" + id + "'\n\n" + gl.getShaderInfoLog(shader));
	return shader;
}

function createAndLinkProgram(fsId) {
	var program = gl.createProgram();
	gl.attachShader(program, getShader(gl, "vertex"));
	gl.attachShader(program, getShader(gl, fsId));
	gl.linkProgram(program);
	return program;
}

var prog_convert2float = createAndLinkProgram("convert2float");
var prog_composite = createAndLinkProgram("composite");
var prog_advanceDepth = createAndLinkProgram("advanceDepth");

// mesh rendering

function createTexturedMeshBuffer(mesh) {
	mesh.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
	mesh.aPosLoc = gl.getAttribLocation(prog_convert2float, "aPos");
	gl.enableVertexAttribArray(mesh.aPosLoc);
	mesh.aTexLoc = gl.getAttribLocation(prog_convert2float, "aTexCoord");
	gl.enableVertexAttribArray(mesh.aTexLoc);
	mesh.texCoordOffset = mesh.vertices.byteLength;
	gl.bufferData(gl.ARRAY_BUFFER, mesh.texCoordOffset + mesh.texCoords.byteLength, gl.STATIC_DRAW);
	gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.vertices);
	gl.bufferSubData(gl.ARRAY_BUFFER, mesh.texCoordOffset, mesh.texCoords);
	setGeometryVertexAttribPointers(mesh);
}

function setGeometryVertexAttribPointers(mesh) {
	gl.vertexAttribPointer(mesh.aPosLoc, mesh.vertexSize, gl.FLOAT, gl.FALSE, 0, 0);
	gl.vertexAttribPointer(mesh.aTexLoc, 2, gl.FLOAT, gl.FALSE, 0, mesh.texCoordOffset);
}

var quadMesh = {
	vertices: new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]),
	texCoords: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
	vertexSize: 3,
	vertexCount: 4,
	type: gl.TRIANGLE_STRIP
};

createTexturedMeshBuffer(quadMesh);

function useMesh(mesh) {
	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
	setGeometryVertexAttribPointers(mesh);
}

function renderMesh(mesh, targetFBO) {
	useMesh(mesh);
	gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
	gl.drawArrays(mesh.type, 0, mesh.vertexCount);
	gl.flush();
}

function convertDepth2float() {
	gl.viewport(0, 0, 512, 512);
	gl.useProgram(prog_convert2float);
	gl.uniform1i(gl.getUniformLocation(prog_convert2float, "rawDepth"), 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, tex_depthRaw);
	renderMesh(quadMesh, FBO_floatdepth);
}

function advancePass(sourceTex, targetFBO, horizontal) {
	gl.viewport(0, 0, 512, 512);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, tex_depthFloat);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sourceTex);

	gl.useProgram(prog_advanceDepth);

	gl.uniform1i(gl.getUniformLocation(prog_advanceDepth, "unadvancedDepth"), 0);
	gl.uniform1i(gl.getUniformLocation(prog_advanceDepth, "advancedDepth"), 1);

	if (horizontal) {
		gl.uniform2f(gl.getUniformLocation(prog_advanceDepth, "oooo"), 1 / 512, 0);
	} else {
		gl.uniform2f(gl.getUniformLocation(prog_advanceDepth, "oooo"), 0, 1 / 512);
	}

	renderMesh(quadMesh, targetFBO);
}

function advanceDepth() {
	// do the first iteration from the original float depth texture
	advancePass(tex_depthFloat, FBO_depthAdvancedHelper, true);
	advancePass(tex_depthAdvancedHelper, FBO_depthAdvanced, false);
}

var posX = 0.5;
var posY = 0.5;
document.onmousemove = function (ev) {
	posX = ev.clientX / viewX;
	posY = 1 - ev.clientY / viewY;
}

function composite() {
	gl.viewport(0, 0, viewX, viewY);
	gl.useProgram(prog_composite);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, tex_depthRaw);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, tex_depthFloat);
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, tex_depthAdvanced);

	gl.uniform1i(gl.getUniformLocation(prog_composite, "rawDepth"), 0);
	gl.uniform1i(gl.getUniformLocation(prog_composite, "floatDepth"), 1);
	gl.uniform1i(gl.getUniformLocation(prog_composite, "advancedDepth"), 2);

	gl.uniform2f(gl.getUniformLocation(prog_composite, "cursorPos"), posX, posY);

	renderMesh(quadMesh, null);
}

main(); // start