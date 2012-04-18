var inherit = (function () {
	var F = function () {};
	return function (C, P) {
		F.prototype = P.prototype;
		C.prototype = new F(); 
		C.uber = P.prototype;
		C.prototype.constructor = C;
	}
})();

function Shape(set) {
	this.setInitial(set);
}

Shape.prototype.getName = function (name) {
	var c = this.constructor;
	if ( !c.count ) c.count = 1;
	return c.name + c.count++;
};

Shape.prototype.setInitial = function (set) {
	this.name = 'Shape'
	this.x = set.x || 0;
	this.y = set.y || 0;
	this.w = set.w || 10;
	this.h = set.h || 10;
	this.fill = set.fill || '#AAAAAA';
	this.draggable = set.draggable || true;
};

// Draws this shape to a given context
Shape.prototype.draw = function(ctx) {
  ctx.fillStyle = this.fill;
  ctx.fillRect(this.x, this.y, this.w, this.h);
};

// Determine if a point is inside the shape's bounds
Shape.prototype.contains = function(mx, my) {
  return  (this.x <= mx) && (this.x + this.w >= mx) &&
          (this.y <= my) && (this.y + this.h >= my);
};

Shape.prototype.save = function () {
	this.saved = this.saved || {};
	this.saved.name = this.name;
	this.saved.position = {x: this.x, y: this.y};
}

Shape.prototype.backward = function () {
	var pos = this.saved.position;
	this.x = pos.x;
	this.y = pos.y;
}

// Check if block dropped on this shape
Shape.prototype.accept = function (block) {
	// check top-bottom borders
	for (var t = block.x; t < block.x + block.w; t++ ) {
		if ( this.contains(t, block.y) || 
			 this.contains(t, block.y+block.h) ) return true;
	}
	// check right-left borders
	for (var r = block.y; r < block.y + block.h; r++) {
		if ( this.contains(block.x+block.w, r) || 
			 this.contains(block.x, r) ) return true;
	}
};

// Text shape class
function Text (set) {
	this.text = set.text || "";
};
inherit(Text,Shape);

Text.prototype.setText = function (txt) {
	this.text = txt;
};

Text.prototype.draw = function (ctx) {
  ctx.fillStyle = this.fill;
  ctx.fillRect(this.x, this.y, this.w, this.h);	
};

Text.prototype.hide = function (ctx) {
	
};

function Spike (set) {
	this.setInitial(set);
	this.w = 5;
	this.h = 80;
	this.fill = 'rgba(66, 70, 72, .8)';
	this.draggable = false;
	this.name = this.getName('Spike');
	this.blocks = [];
};
inherit(Spike, Shape);

Spike.prototype.addBlock = function (block) {
	this.blocks.push(block);
};

Spike.prototype.popBlock = function (block) {
	this.blocks.pop();
};

Spike.prototype.has = function (block) {
	var len = this.blocks.length;
	while ( len-- ) {
		if (this.blocks[len].name == block.name ) return true;
	}
	return false;
};

Spike.prototype.getTop = function () {
	var last = this.blocks.length - 1;
	return this.blocks[last] || null;
};

Spike.prototype.isTop = function (block) {
	return this.getTop().name == block.name;
};

function Block (set) {
	this.setInitial(set);
	this.name = this.getName('Block');
	this.size = 0;
	this.drag = function () {};
	this.drop = function () {
		console.log(this.name, 'dropped');
	}
	this.select = function () {
		console.log(this.name, ' selected!');
	};
};
inherit(Block, Shape);

// in case we could extend block method
Block.prototype.save = function () {
	Block.uber.save.apply(this, arguments);
	this.saved.size = this.size;
};

Block.prototype.backward = function () {
	Block.uber.backward.apply(this, arguments);
}


function CanvasState(canvas, level) {
	if (CanvasState.state) return CanvasState.state;
  // **** First some setup! ****
	this.canvas = canvas;
	this.width = canvas.width;
	this.height = canvas.height;
	this.ctx = canvas.getContext('2d');
	this.interval = 30;
	this.selectionColor = level.selectionColor || '#CC0000';
	this.selectionWidth = level.selectionWidth || 2;
	this.level = level;

// **** Keep track of state! ****
	this.valid = false; // when set to false, the canvas will redraw everything
	this.shapes = level.getShapes() || [];
	this.texts = level.getTexts() || [];
	this.dragging = false;
	this.selection = null;
	this.dragoffx = 0;
	this.dragoffy = 0;
	
	var state = CanvasState.state = this; // our state clojure

	this.fixMouseCoordinates();
	this.addEvents();
	
	setInterval(function() { state.draw(); }, state.interval);
};

// fixes mouse co-ordinate problems when there's a border or padding.
CanvasState.prototype.fixMouseCoordinates = function () {
	var canvas = this.canvas;
	if (document.defaultView && document.defaultView.getComputedStyle) {
	    this.stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10)      || 0;
	    this.stylePaddingTop  = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10)       || 0;
	    this.styleBorderLeft  = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10)  || 0;
	    this.styleBorderTop   = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10)   || 0;
	}
	// Repair pages with fixed-position bars (like the stumbleupon bar)
	var html = document.body.parentNode;
	this.htmlTop = html.offsetTop;
	this.htmlLeft = html.offsetLeft;
};

CanvasState.prototype.addEvents = function () {
	var canvas = this.canvas,
		state = CanvasState.state;
	//fixes a problem where double clicking causes text to get selected on the canvas
	canvas.addEventListener('selectstart', function(e) { 
		e.preventDefault(); 
		return false; 
	}, false);
	canvas.addEventListener('mousedown', function (e) {
		state.selectShape(e);
		if (state.selection) {
			state.level.select(state.selection);
		}
	}, true);
	canvas.addEventListener('mousemove', function(e) { 
		if (state.dragReady && state.level.canDrag() ) {
			state.dragging = true;
			state.dragShape(e);
			state.level.drag(state.selection);
		};
	}, true);
	canvas.addEventListener('mouseup', function(e) {
		if (state.dragging) {
			state.level.drop(state.selection);
		}
		state.dragging = false;
		state.dragReady = false;
	}, true);
};

// Up, down, and move are for dragging
CanvasState.prototype.selectShape = function(e) {
	var mouse = this.getMouse(e),
		mx = mouse.x,
		my = mouse.y;
	if ( this.findMatched(mx,my) ) {
		this.smoothDragging(mx,my);
		this.dragReady = true;
		this.redraw();
	} else {
		this.level.deselect();
		this.deselectAll();
	}
};

CanvasState.prototype.findMatched = function (mx, my) {
	var shapes = this.shapes,
		l = shapes.length;
	for ( var i = l-1; i >= 0; i-- ) {
		if ( shapes[i].contains(mx, my) && shapes[i].draggable ) {
			this.selection = shapes[i];
			return true;
		}
	}
	return false;
};

CanvasState.prototype.smoothDragging = function (mx,my) {
	this.dragoffx = mx - this.selection.x;
	this.dragoffy = my - this.selection.y;
}

CanvasState.prototype.deselectAll = function () {
	if (this.selection) {
		this.selection = null;
		this.redraw();
	}	
};

CanvasState.prototype.dragShape = function (event) {
	var mouse = this.getMouse(event);
    // We don't want to drag the object by its top-left corner, we want to drag it
    // from where we clicked. Thats why we saved the offset and use it here
    this.selection.x = mouse.x - this.dragoffx;
    this.selection.y = mouse.y - this.dragoffy;
    this.redraw();
};

CanvasState.prototype.addShape = function(shape) {
  this.shapes.push(shape);
  this.redraw();
};

CanvasState.prototype.clear = function() {
  this.ctx.clearRect(0, 0, this.width, this.height);
};

// to call redraw from out the state (e.g. level)
CanvasState.redraw = function () {
	CanvasState.state.redraw();
}

// set state to redraw
CanvasState.prototype.redraw = function () {
	this.valid = false;
}

// While draw is called as often as the INTERVAL variable demands,
// It only ever does something if the canvas gets invalidated by our code
CanvasState.prototype.draw = function() {
	// if our state is invalid, redraw and validate!
	if ( !this.valid ) {
		this.clear();
		
	    // ** Add stuff you want drawn in the background all the time here **
		this.drawShapes();
		this.drawTexts();
		if ( this.selection ) this.highlight(this.selection);
		this.valid = true;
	}
};

CanvasState.prototype.drawShapes = function () {
	var ctx = this.ctx,
		l = this.shapes.length;
	for ( var i = 0; i < l; i++ ) {
		var shape = this.shapes[i];
		// We can skip the drawing of elements that have moved off the screen:
		if ( this.offScreen(shape) ) continue;
		this.shapes[i].draw(ctx);
	}
};

CanvasState.prototype.drawTexts = function () {
	var ctx = this.ctx,
		l = this.texts.length;
	for ( var i = 0; i < l; i++ ) {
		var text = this.texts[i];
		this.texts[i].draw(ctx);
	}
};

CanvasState.prototype.offScreen = function (shape) {
	return ( shape.x > this.width || 
			shape.y > this.height ||
			shape.x + shape.w < 0 || 
			shape.y + shape.h < 0 );
};

CanvasState.prototype.highlight = function (shape) {
	var ctx = this.ctx;
    ctx.strokeStyle = this.selectionColor;
    ctx.lineWidth = this.selectionWidth;
	ctx.strokeRect(shape.x,shape.y,shape.w,shape.h);
};

// Creates an object with x and y defined, set to the mouse position relative to the state's canvas
// If you wanna be super-correct this can be tricky, we have to worry about padding and borders
CanvasState.prototype.getMouse = function(e) {
  var element = this.canvas, offsetX = 0, offsetY = 0, mx, my;
  
  // Compute the total offset
  if (element.offsetParent !== undefined) {
    do {
      offsetX += element.offsetLeft;
      offsetY += element.offsetTop;
    } while (element = element.offsetParent);
  }

  // Add padding and border style widths to offset
  // Also add the <html> offsets in case there's a position:fixed bar
  offsetX += this.stylePaddingLeft + this.styleBorderLeft + this.htmlLeft;
  offsetY += this.stylePaddingTop + this.styleBorderTop + this.htmlTop;

  mx = e.pageX - offsetX;
  my = e.pageY - offsetY;
  return {x: mx, y: my};
};

function Level (sets) {
	this.name = sets.name;
	this.selectionColor = sets.selectionColor;
	this.selectionWidth = sets.selectionWidth;
	this.spikes = sets.spikes;
	this.blocks = sets.blocks;
	this.winSpike = 2;
	this.onwin = sets.onwin || function (){};
	this.selected = null;
	
	this.drag = sets.drag || function () {};
	this.drop = sets.drop || function () {};
	this.select = sets.select || function () {};
	this.deselect = sets.deselect || function () {};
	
	this.fillSpikes();
}

Level.prototype.fillSpikes = function () {
	for ( var i = 0; i < this.blocks.length; i++ ) {
		this.spikes[0].addBlock(this.blocks[i]);
	}
};

Level.prototype.getShapes = function () {
	return this.spikes.concat(this.blocks);	
};

// Determine if block dropped on spike
Level.prototype.spikeAccept = function (block) {
	var spikes = this.spikes,
		len = spikes.length;
	while (len--) {
		if ( spikes[len].accept(block) ) return spikes[len];
	}
	return false;
};

Level.prototype.findSpike = function (block) {
	var len = this.spikes.length;
	while (len-- ) {
		if (this.spikes[len].has(block)) return this.spikes[len];
	}
};

Level.prototype.getTexts = function () {
	
};

// When selected block, CanvasState ask level if dragging allowed
Level.prototype.canDrag = function () {
	return this.isTop(this.selected.spike, this.selected);
};

// By the rules smaller lays on bigger, not vice versa
Level.prototype.canDrop = function (spike, block) {
	var top = spike.getTop();
	return !( (top && top.w < block.w) || (spike == this.selected.spike) );
};

Level.prototype.isTop = function (spike, block) {
	return spike.isTop(block);
};

// if block draged on another spike, fit it gently
Level.prototype.fit = function (spike, block) {
	var top = spike.getTop();
	if (top) {
		block.y = top.y - block.h; 
	} else {
		block.y = spike.y + spike.h - block.h;
	}
	spike.center = spike.x + (spike.w / 2);
	block.x = spike.center - block.w/2;
	block.save(spike);
};

Level.prototype.dropBlock = function (spike, block) {
	if ( spike && this.canDrop(spike, block) ) {
		this.fit(spike, block);
		this.selected.spike.popBlock();
		spike.addBlock(block);
	} else {
		block.backward();
	}
	block.drop();
};

Level.prototype.winState = function () {
	return this.spikes[this.winSpike].blocks.length == 3;
};

Level.prototype.win = function () {
	this.onwin();	
};

/* Game statistics */
function Statistic () {
	this.moves = 0;
};

function init() {
	var s = new CanvasState(document.getElementById('canvas'), new Level({
		name: 'First',
		spikes: [
			new Spike({x:62,y:190}),
			new Spike({x:142,y:190}),
			new Spike({x:222,y:190})
		],
		blocks: [
			new Block({x:22,y:250,w:85,h:20, fill:'rgba(20, 217, 94, .5)'}),
			new Block({x:34,y:230,w:60,h:20, fill:'rgba(61, 114, 232, .5)'}),
			new Block({x:45,y:210,w:40,h:20, fill:'rgba(231, 82, 82, .5)'})
		],
		selectionWidth: 2,
		
		drag: function (block) {
			block.drag();
		},
		
		drop: function (block) {
			var spike = this.spikeAccept(block);
			this.dropBlock(spike, block);
			if ( this.winState() ) {
				this.win();	
			}
			CanvasState.redraw();
		},
		
		select: function (block) {
			this.selected = block;
			this.selected.spike = this.findSpike(block);
			block.save();
			block.select();
		},
		
		deselect: function () {},
		onwin: function () {
			document.getElementById('win').className = '';
		}
		
	}));
	return {
		state: s
	}
};
