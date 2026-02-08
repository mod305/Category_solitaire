export class GameUI {
    constructor(game) {
        this.game = game;
        this.app = document.getElementById('app');
        this.sortingArea = document.getElementById('sorting-area');
        this.tableauArea = document.getElementById('tableau-area');
        this.graveyard = document.getElementById('graveyard'); // Open Pile
        this.deckPile = document.getElementById('deck-pile'); // Hidden Draw Pile
        this.turnsValue = document.getElementById('turns-value');

        this.draggedCard = null;
        this.dragSource = null;
        this.dragGhost = null;
        this.touchDragCardId = null;
    }

    init() {
        this.renderLayout();
        this.setupDifficultyUI();
    }

    setupDifficultyUI() {
        const buttons = document.querySelectorAll('.diff-btn');
        buttons.forEach(btn => {
            btn.onclick = () => {
                // Update UI
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Update Game Config and Restart
                this.game.setDifficulty(btn.dataset.diff);
            };
        });
    }

    renderLayout() {
        // Sorting Slots - FIXED at 4
        this.sortingArea.innerHTML = '';
        // We create 4 empty slots regardless of category count
        for (let i = 0; i < 4; i++) {
            const slot = document.createElement('div');
            slot.className = 'slot sorting-slot';
            slot.dataset.index = i;
            this.makeDroppable(slot, 'sorting', i);
            this.sortingArea.appendChild(slot);
        }

        // Tableau Columns - Remains 4
        this.tableauArea.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const col = document.createElement('div');
            col.className = 'tableau-column';
            col.dataset.index = i;

            const base = document.createElement('div');
            base.className = 'slot-base';
            this.makeDroppable(base, 'tableau', i);

            col.appendChild(base);
            this.tableauArea.appendChild(col);
        }

        // Deck Loop Click
        this.deckPile.onclick = () => this.game.drawCard();

        // Restart Button
        document.getElementById('restart-btn').onclick = () => this.game.restart();
    }

    update(state) {
        this.turnsValue.textContent = state.turnsLeft;

        // Sync Difficulty UI
        const diffButtons = document.querySelectorAll('.diff-btn');
        diffButtons.forEach(btn => {
            if (btn.dataset.diff === this.game.difficulty) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 1. Sorting Slots
        state.sortingSlots.forEach((pile, i) => {
            const slot = this.sortingArea.children[i];

            // Update Label based on content
            if (pile.length > 0) {
                const keyCard = pile[0];
                // Look up current game category config
                const catConfig = this.game.activeCategories[keyCard.category];

                // Calculate counters
                const total = catConfig.itemCount; // Dynamically set item count
                const current = pile.length - 1; // Subtract Key Card

                // Format: Category (Newline) (Total/Collected)
                slot.setAttribute('data-label', `${catConfig.label}\n(${total}/${current})`);
            } else {
                slot.removeAttribute('data-label');
            }

            // Clean
            const oldCards = slot.querySelectorAll('.card');
            oldCards.forEach(c => c.remove());

            if (pile.length > 0) {
                const topCard = pile[pile.length - 1];
                const cardEl = this.createCardElement(topCard);
                cardEl.dataset.sourceType = 'sorting';
                cardEl.dataset.sourceIndex = i;
                slot.appendChild(cardEl);
            }
        });

        // 2. Tableau
        const cols = document.querySelectorAll('.tableau-column');
        cols.forEach((col, i) => {
            const pile = state.tableauSlots[i];
            const cards = col.querySelectorAll('.card');
            cards.forEach(c => c.remove());

            pile.forEach((card, cardIndex) => {
                const isLast = cardIndex === pile.length - 1;
                let cardEl;

                // Use persistent faceUp state OR default to isLast if undefined (safe fallback)
                const isFaceUp = card.faceUp === true;

                if (isFaceUp) {
                    // Front Face
                    cardEl = this.createCardElement(card);
                    cardEl.draggable = true;

                    // If this card is NOT the last one (i.e. covered by others), align text to top
                    if (!isLast && card.type !== 'KEY') {
                        cardEl.classList.add('stacked-view');
                    }
                } else {
                    // Back Face
                    cardEl = document.createElement('div');
                    cardEl.className = 'card back';

                    // Rabbit Icon for back
                    const rabbit = document.createElement('div');
                    rabbit.className = 'rabbit-icon';
                    cardEl.appendChild(rabbit);

                    cardEl.draggable = false;
                }

                cardEl.style.top = `${cardIndex * 35}px`;
                cardEl.style.zIndex = cardIndex + 1;

                cardEl.dataset.sourceType = 'tableau';
                cardEl.dataset.sourceIndex = i;
                cardEl.dataset.cardIndex = cardIndex;

                if (!isLast) {
                    cardEl.style.cursor = 'default';
                }

                // FIX: Make the card itself droppable so we can stack on it
                this.makeDroppable(cardEl, 'tableau', i);

                col.appendChild(cardEl);
            });
        });

        // 3. Open Pile (Graveyard/Discard)
        const openCards = this.graveyard.querySelectorAll('.card');
        openCards.forEach(c => c.remove());

        if (state.openPile.length > 0) {
            const topCard = state.openPile[state.openPile.length - 1];
            const cardEl = this.createCardElement(topCard);
            cardEl.draggable = true;
            cardEl.dataset.sourceType = 'graveyard';
            this.graveyard.appendChild(cardEl);
        }

        // 4. Draw Pile (Deck) - Visual Thickness
        this.renderDeckThickness(state.deck.length);
    }

    renderDeckThickness(count) {
        this.deckPile.innerHTML = '';
        if (count > 0) {
            const backCard = document.createElement('div');
            backCard.className = 'card back';

            const thickness = Math.min(Math.floor(count / 2), 10);
            const shadow = Array.from({ length: thickness }, (_, i) =>
                `${i + 1}px ${i + 1}px 0 #8d6e63`
            ).join(', ');

            backCard.style.boxShadow = shadow || 'none';

            const rabbit = document.createElement('div');
            rabbit.className = 'rabbit-icon';
            backCard.appendChild(rabbit);

            this.deckPile.appendChild(backCard);
        } else {
            this.deckPile.innerHTML = '<div style="opacity:0.3; color:white;">EMPTY</div>';
        }
    }

    createCardElement(card) {
        const el = document.createElement('div');
        const typeClass = card.type === 'KEY' ? 'key-card' : 'sub-card';
        el.className = `card ${typeClass}`;
        el.draggable = true;
        el.dataset.id = card.id;

        // Content
        const label = document.createElement('span');
        label.className = 'label';
        label.style.fontSize = '14px'; // Smaller font for stack visibility
        label.style.lineHeight = '1.2';

        // Image Mode Support: Use Emoji if enabled for this category
        // EXCEPTION: Key Cards always show Text
        const catConfig = this.game.activeCategories[card.category];
        if (catConfig && catConfig.isImageMode && card.emoji && card.type !== 'KEY') {
            label.textContent = card.emoji;
            label.style.fontSize = '2rem'; // Larger for emoji
        } else {
            label.textContent = card.label;
        }

        el.appendChild(label);

        // Add Counter for Key Card
        if (card.type === 'KEY') {
            // Calculate count
            const catId = card.category;
            const collected = this.game.getCollectedCount(catId);
            const total = catConfig ? catConfig.itemCount : 8;

            const counter = document.createElement('div');
            counter.className = 'key-counter';
            counter.textContent = `${total} / ${collected}`;
            el.appendChild(counter);
        }

        el.addEventListener('dragstart', (e) => this.handleDragStart(e, card));

        // Touch Events for Mobile
        el.addEventListener('touchstart', (e) => this.handleTouchStart(e, card), { passive: false });
        el.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        el.addEventListener('touchend', (e) => this.handleTouchEnd(e, card));

        return el;
    }

    makeDroppable(el, type, index = -1) {
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (el.classList.contains('slot')) el.style.backgroundColor = 'rgba(255,255,255,0.1)';
        });

        el.addEventListener('dragleave', (e) => {
            if (el.classList.contains('slot')) el.style.backgroundColor = '';
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            if (el.classList.contains('slot')) el.style.backgroundColor = '';
            const cardId = e.dataTransfer.getData('text/plain');
            this.game.handleDrop(cardId, type, index);
        });
    }

    handleDragStart(e, card) {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
    }

    // --- TOUCH SUPPORT ---
    handleTouchStart(e, card) {
        e.preventDefault(); // Stop scrolling
        const touch = e.touches[0];

        // Create Ghost
        this.dragGhost = document.createElement('div');
        this.dragGhost.className = e.target.className;
        this.dragGhost.innerHTML = e.target.innerHTML;
        this.dragGhost.style.position = 'fixed';
        this.dragGhost.style.width = getComputedStyle(e.target).width;
        this.dragGhost.style.height = getComputedStyle(e.target).height;
        this.dragGhost.style.left = `${touch.clientX - 30}px`;
        this.dragGhost.style.top = `${touch.clientY - 40}px`;
        this.dragGhost.style.opacity = '0.9';
        this.dragGhost.style.zIndex = '1000';
        this.dragGhost.style.pointerEvents = 'none'; // click-through
        this.dragGhost.style.transform = 'scale(1.1)';

        document.body.appendChild(this.dragGhost);

        // Store data
        this.touchDragCardId = card.id;
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (!this.dragGhost) return;
        const touch = e.touches[0];
        this.dragGhost.style.left = `${touch.clientX - 30}px`;
        this.dragGhost.style.top = `${touch.clientY - 40}px`;
    }

    handleTouchEnd(e, card) {
        if (this.dragGhost) {
            this.dragGhost.remove();
            this.dragGhost = null;
        }

        if (!this.touchDragCardId) return;

        const touch = e.changedTouches[0];
        // Find drop target (we need to hide the ghost first? we did remove it above)
        // We need to find the element *under* the finger

        // Hide any potential overlay temporarily if needed (ghost is already removed)
        const droppedEl = document.elementFromPoint(touch.clientX, touch.clientY);

        if (droppedEl) {
            // Traverse up to find a droppable zone or styled card
            // We need to identify if it's a Slot, Base, or Card in Tableau/Sorting

            let target = droppedEl.closest('.slot, .slot-base, .tableau-column .card');

            if (target) {
                // Extract type and index from the closest significant element
                // But wait, our 'makeDroppable' attached listeners to specific elements.
                // We need to map the element back to 'type' and 'index'.

                // If dropped on a card in tableau
                if (target.classList.contains('card') && target.dataset.sourceType === 'tableau') {
                    const type = 'tableau';
                    const index = parseInt(target.dataset.sourceIndex);
                    this.game.handleDrop(this.touchDragCardId, type, index);
                }
                // If dropped on slot-base
                else if (target.classList.contains('slot-base')) {
                    // Find parent column index?
                    // Actually makeDroppable passed index. We can store it in dataset for fallback.
                    // Our makeDroppable doesn't set dataset on base, but parent col has index.
                    const col = target.closest('.tableau-column');
                    if (col) {
                        this.game.handleDrop(this.touchDragCardId, 'tableau', parseInt(col.dataset.index));
                    }
                }
                // If dropped on sorting slot
                else if (target.classList.contains('sorting-slot')) {
                    this.game.handleDrop(this.touchDragCardId, 'sorting', parseInt(target.dataset.index));
                }
            }
        }

        this.touchDragCardId = null;
    }
}
