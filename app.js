// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const infoText = document.getElementById('infoText');

// Resize canvas to fill container
function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Set canvas size to match container
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Redraw everything after resize
    redraw();
}

// Call resize on load and window resize
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);

// State
let shapes = [];
let currentTool = 'square'; // Default tool
let currentColor = null;
let isDrawing = false;
let startX, startY;
let selectedShape = null;
let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Grid settings
const GRID_SIZE = 20;

// Snap to grid function
function snapToGrid(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Shape class
class Shape {
    constructor(type, x, y, width, height, color = null) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.id = Date.now() + Math.random();
    }

    draw() {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.fillStyle = this.color || 'transparent';

        if (this.type === 'rectangle') {
            if (this.color) ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        } else if (this.type === 'square') {
            const size = Math.max(Math.abs(this.width), Math.abs(this.height));
            const drawWidth = this.width < 0 ? -size : size;
            const drawHeight = this.height < 0 ? -size : size;
            if (this.color) ctx.fillRect(this.x, this.y, drawWidth, drawHeight);
            ctx.strokeRect(this.x, this.y, drawWidth, drawHeight);
        } else if (this.type === 'circle') {
            const radius = Math.abs(this.width) / 2;
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            if (this.color) ctx.fill();
            ctx.stroke();
        } else if (this.type === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.lineTo(this.x, this.y + this.height);
            ctx.closePath();
            if (this.color) ctx.fill();
            ctx.stroke();
        }
    }

    drawSelection() {
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.setLineDash([]);

        // Draw resize handles
        const handles = this.getResizeHandles();
        handles.forEach(handle => {
            ctx.fillStyle = '#667eea';
            ctx.fillRect(handle.x - 4, handle.y - 4, 8, 8);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(handle.x - 4, handle.y - 4, 8, 8);
        });
    }

    getResizeHandles() {
        return [
            { x: this.x, y: this.y, position: 'nw' },
            { x: this.x + this.width / 2, y: this.y, position: 'n' },
            { x: this.x + this.width, y: this.y, position: 'ne' },
            { x: this.x, y: this.y + this.height / 2, position: 'w' },
            { x: this.x + this.width, y: this.y + this.height / 2, position: 'e' },
            { x: this.x, y: this.y + this.height, position: 'sw' },
            { x: this.x + this.width / 2, y: this.y + this.height, position: 's' },
            { x: this.x + this.width, y: this.y + this.height, position: 'se' }
        ];
    }

    containsPoint(x, y) {
        if (this.type === 'circle') {
            const radius = Math.abs(this.width) / 2;
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            return distance <= radius;
        } else if (this.type === 'triangle') {
            // Triangle vertices
            const x1 = this.x + this.width / 2;  // Top point
            const y1 = this.y;
            const x2 = this.x + this.width;      // Bottom right
            const y2 = this.y + this.height;
            const x3 = this.x;                   // Bottom left
            const y3 = this.y + this.height;

            // Calculate area of the triangle using the three vertices
            const areaOrig = Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1));
            
            // Calculate area of three triangles formed with the point
            const area1 = Math.abs((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y));
            const area2 = Math.abs((x2 - x) * (y3 - y) - (x3 - x) * (y2 - y));
            const area3 = Math.abs((x3 - x) * (y1 - y) - (x1 - x) * (y3 - y));
            
            // Point is inside if sum of areas equals original area (with small tolerance)
            return Math.abs(areaOrig - (area1 + area2 + area3)) < 1;
        } else {
            return (
                x >= Math.min(this.x, this.x + this.width) &&
                x <= Math.max(this.x, this.x + this.width) &&
                y >= Math.min(this.y, this.y + this.height) &&
                y <= Math.max(this.y, this.y + this.height)
            );
        }
    }

    getResizeHandleAt(x, y) {
        const handles = this.getResizeHandles();
        for (let handle of handles) {
            if (Math.abs(x - handle.x) <= 6 && Math.abs(y - handle.y) <= 6) {
                return handle.position;
            }
        }
        return null;
    }
}

// Tool buttons
document.getElementById('rectBtn').addEventListener('click', () => {
    setTool('rectangle');
    setActiveButton('rectBtn');
    // Deselect all colors when switching to shape tool
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    currentColor = null;
});

document.getElementById('circleBtn').addEventListener('click', () => {
    setTool('circle');
    setActiveButton('circleBtn');
    // Deselect all colors when switching to shape tool
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    currentColor = null;
});

document.getElementById('triangleBtn').addEventListener('click', () => {
    setTool('triangle');
    setActiveButton('triangleBtn');
    // Deselect all colors when switching to shape tool
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    currentColor = null;
});

document.getElementById('squareBtn').addEventListener('click', () => {
    setTool('square');
    setActiveButton('squareBtn');
    // Deselect all colors when switching to shape tool
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    currentColor = null;
});

document.getElementById('selectBtn').addEventListener('click', () => {
    setTool('select');
    setActiveButton('selectBtn');
    // Deselect all colors when switching to select mode
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    currentColor = null;
});

function setTool(tool) {
    currentTool = tool;
    selectedShape = null;
    if (tool === 'select') {
        canvas.classList.add('select-mode');
        updateInfo('Klicken Sie auf eine Form zum Auswählen, ziehen zum Verschieben oder ziehen Sie die Griffe zum Skalieren.');
    } else {
        canvas.classList.remove('select-mode');
        const toolNames = {
            'square': 'Quadrat',
            'rectangle': 'Rechteck',
            'circle': 'Kreis',
            'triangle': 'Dreieck'
        };
        updateInfo(`${toolNames[tool]} zeichnen. Klicken und ziehen Sie auf der Leinwand.`);
    }
    redraw();
}

function setActiveButton(btnId) {
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(btnId).classList.add('active');
}

// Color buttons
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        currentColor = color;
        
        // Update active state
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Automatically switch to select mode to allow coloring
        if (currentTool !== 'select') {
            setTool('select');
            setActiveButton('selectBtn');
        }

        updateInfo(`Farbe ${color} ausgewählt. Klicken Sie auf Formen, um sie mit dieser Farbe zu füllen.`);
    });
});

// Action buttons
document.getElementById('deleteBtn').addEventListener('click', () => {
    if (selectedShape) {
        shapes = shapes.filter(s => s.id !== selectedShape.id);
        selectedShape = null;
        redraw();
        updateInfo('Form gelöscht.');
    } else {
        updateInfo('Wählen Sie zuerst eine Form aus, um sie zu löschen.');
    }
});

document.getElementById('clearShapesBtn').addEventListener('click', () => {
    if (confirm('Sind Sie sicher, dass Sie alle Formen löschen möchten?')) {
        shapes = [];
        selectedShape = null;
        redraw();
        updateInfo('Alle Formen gelöscht.');
    }
});

document.getElementById('clearFillBtn').addEventListener('click', () => {
    shapes.forEach(shape => shape.color = null);
    redraw();
    updateInfo('Alle Füllfarben gelöscht.');
});

document.getElementById('exportBtn').addEventListener('click', () => {
    const data = JSON.stringify(shapes, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formen_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    updateInfo('Formen erfolgreich exportiert.');
});

document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                shapes = data.map(s => {
                    const shape = new Shape(s.type, s.x, s.y, s.width, s.height, s.color);
                    shape.id = s.id;
                    return shape;
                });
                selectedShape = null;
                redraw();
                updateInfo(`${shapes.length} Formen importiert.`);
            } catch (error) {
                alert('Fehler beim Importieren der Datei. Bitte stellen Sie sicher, dass es eine gültige JSON-Datei ist.');
                updateInfo('Import fehlgeschlagen.');
            }
        };
        reader.readAsText(file);
    }
    e.target.value = '';
});

document.getElementById('hideGridBtn').addEventListener('click', () => {
    const currentBackground = canvas.style.background;
    if (currentBackground == '') {
        canvas.style.background =
            `linear-gradient(90deg, #f5f5f5 1px, transparent 1px),
             linear-gradient(180deg, #f5f5f5 1px, transparent 1px)`;
    } else {
        canvas.style.background = '';
    }
    redraw();  
})

// Canvas mouse events
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'select') {
        // Check if clicking on a resize handle
        if (selectedShape) {
            resizeHandle = selectedShape.getResizeHandleAt(x, y);
            if (resizeHandle) {
                isResizing = true;
                startX = x;
                startY = y;
                return;
            }
        }

        // Check if clicking on a shape
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (shapes[i].containsPoint(x, y)) {
                // If a color is selected, apply it to the shape
                if (currentColor) {
                    shapes[i].color = currentColor;
                    redraw();
                    updateInfo(`Farbe ${currentColor} auf Form angewendet.`);
                    return;
                }
                
                // Otherwise, select the shape for moving/resizing
                selectedShape = shapes[i];
                isDragging = true;
                dragOffsetX = x - selectedShape.x;
                dragOffsetY = y - selectedShape.y;
                
                // Deselect all colors and use transparent
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                currentColor = null;
                
                redraw();
                updateInfo('Form ausgewählt. Ziehen zum Verschieben oder verwenden Sie die Griffe zum Skalieren.');
                return;
            }
        }

        // Clicked on empty space
        selectedShape = null;
        redraw();
        if (currentColor) {
            updateInfo(`Farbe ${currentColor} ausgewählt. Klicken Sie auf eine Form zum Anwenden.`);
        } else {
            updateInfo('Klicken Sie auf eine Form, um sie auszuwählen.');
        }
    } else {
        // Drawing mode - snap start position to grid
        isDrawing = true;
        startX = snapToGrid(x);
        startY = snapToGrid(y);
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing) {
        redraw();
        // Snap current position to grid
        const snappedX = snapToGrid(x);
        const snappedY = snapToGrid(y);
        const width = snappedX - startX;
        const height = snappedY - startY;
        const tempShape = new Shape(currentTool, startX, startY, width, height);
        tempShape.draw();
    } else if (isDragging && selectedShape) {
        // Snap position to grid while dragging
        const newX = snapToGrid(x - dragOffsetX);
        const newY = snapToGrid(y - dragOffsetY);
        selectedShape.x = newX;
        selectedShape.y = newY;
        redraw();
    } else if (isResizing && selectedShape && resizeHandle) {
        const dx = x - startX;
        const dy = y - startY;

        const originalX = selectedShape.x;
        const originalY = selectedShape.y;
        const originalWidth = selectedShape.width;
        const originalHeight = selectedShape.height;

        switch (resizeHandle) {
            case 'nw':
                selectedShape.x = snapToGrid(selectedShape.x + dx);
                selectedShape.y = snapToGrid(selectedShape.y + dy);
                selectedShape.width = originalX + originalWidth - selectedShape.x;
                selectedShape.height = originalY + originalHeight - selectedShape.y;
                break;
            case 'n':
                selectedShape.y = snapToGrid(selectedShape.y + dy);
                selectedShape.height = originalY + originalHeight - selectedShape.y;
                break;
            case 'ne':
                selectedShape.y = snapToGrid(selectedShape.y + dy);
                selectedShape.width = snapToGrid(originalWidth + dx);
                selectedShape.height = originalY + originalHeight - selectedShape.y;
                break;
            case 'w':
                selectedShape.x = snapToGrid(selectedShape.x + dx);
                selectedShape.width = originalX + originalWidth - selectedShape.x;
                break;
            case 'e':
                selectedShape.width = snapToGrid(originalWidth + dx);
                break;
            case 'sw':
                selectedShape.x = snapToGrid(selectedShape.x + dx);
                selectedShape.width = originalX + originalWidth - selectedShape.x;
                selectedShape.height = snapToGrid(originalHeight + dy);
                break;
            case 's':
                selectedShape.height = snapToGrid(originalHeight + dy);
                break;
            case 'se':
                selectedShape.width = snapToGrid(originalWidth + dx);
                selectedShape.height = snapToGrid(originalHeight + dy);
                break;
        }

        // Prevent negative or too small dimensions
        if (Math.abs(selectedShape.width) < GRID_SIZE) {
            selectedShape.x = originalX;
            selectedShape.width = originalWidth;
        }
        if (Math.abs(selectedShape.height) < GRID_SIZE) {
            selectedShape.y = originalY;
            selectedShape.height = originalHeight;
        }

        startX = x;
        startY = y;
        redraw();
    } else if (currentTool === 'select' && selectedShape && !currentColor) {
        // Only show resize cursors when no color is selected
        // Update cursor based on hover position
        const handle = selectedShape.getResizeHandleAt(x, y);
        if (handle) {
            canvas.style.cursor = getCursorForHandle(handle);
        } else if (selectedShape.containsPoint(x, y)) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'default';
        }
    } else if (currentTool === 'select' && currentColor) {
        // Show pointer cursor when color is selected and hovering over shapes
        let isOverShape = false;
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (shapes[i].containsPoint(x, y)) {
                isOverShape = true;
                break;
            }
        }
        canvas.style.cursor = isOverShape ? 'pointer' : 'default';
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (isDrawing) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Snap end position to grid
        const snappedX = snapToGrid(x);
        const snappedY = snapToGrid(y);
        const width = snappedX - startX;
        const height = snappedY - startY;

        // Only add shape if it has some size (at least one grid unit)
        if (Math.abs(width) >= GRID_SIZE && Math.abs(height) >= GRID_SIZE) {
            const newShape = new Shape(currentTool, startX, startY, width, height, currentColor);
            shapes.push(newShape);
            const toolNames = {
                'square': 'Quadrat',
                'rectangle': 'Rechteck',
                'circle': 'Kreis',
                'triangle': 'Dreieck'
            };
            updateInfo(`${toolNames[currentTool]} erstellt. Zeichnen Sie eine weitere oder wechseln Sie das Werkzeug.`);
        }

        isDrawing = false;
        redraw();
    } else if (isDragging) {
        isDragging = false;
        updateInfo('Form verschoben.');
    } else if (isResizing) {
        isResizing = false;
        resizeHandle = null;
        updateInfo('Form skaliert.');
    }
});

canvas.addEventListener('mouseleave', () => {
    if (isDrawing) {
        isDrawing = false;
        redraw();
    }
    if (isDragging) {
        isDragging = false;
    }
    if (isResizing) {
        isResizing = false;
        resizeHandle = null;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedShape) {
            shapes = shapes.filter(s => s.id !== selectedShape.id);
            selectedShape = null;
            redraw();
            updateInfo('Form gelöscht.');
        }
    }
    else if (e.key === '.') {
        infoText.style.visibility = infoText.style.visibility === 'hidden' ? 'visible' : 'hidden';
    }
});

function getCursorForHandle(handle) {
    const cursors = {
        'nw': 'nw-resize',
        'n': 'n-resize',
        'ne': 'ne-resize',
        'w': 'w-resize',
        'e': 'e-resize',
        'sw': 'sw-resize',
        's': 's-resize',
        'se': 'se-resize'
    };
    return cursors[handle] || 'default';
}

function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach(shape => shape.draw());
    if (selectedShape) {
        selectedShape.drawSelection();
    }
}

function updateInfo(message) {
    infoText.textContent = message;
}

// Toggle sidebar
document.getElementById('toggleSidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('rightSidebar');
    sidebar.classList.toggle('hidden');
    // Resize canvas after sidebar toggle
    setTimeout(resizeCanvas, 300); // Wait for animation to complete
});

// Initialize
resizeCanvas();
updateInfo('Wählen Sie ein Formwerkzeug und klicken-ziehen Sie auf der Leinwand zum Zeichnen.');
