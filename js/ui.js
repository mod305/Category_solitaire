export class GameUI {
    constructor(game) {
        this.game = game;
        this.app = document.getElementById('app');
        this.sortingArea = document.getElementById('sorting-area');
        this.tableauArea = document.getElementById('tableau-area');
        this.graveyard = document.getElementById('graveyard');
        this.turnsValue = document.getElementById('turns-value');

        this.draggedCard = null;
        this.dragSource = null; // { type: 'tableau'|'graveyard', colIndex?: number }
    }

    init() {
        this.renderLayout();
        this.attachGlobalListeners();
    }

    renderLayout() {
        // Create 4 Sorting Slots
        this.sortingArea.innerHTML = '';
        const categoryIds = Object.keys(this.game.categories);

        categoryIds.forEach((catId, index) => {
            const cat = this.game.categories[catId];
            const slot = document.createElement('div');
            slot.className = 'slot sorting-slot';
            slot.dataset.category = catId;
            slot.dataset.label = cat.label;
            slot.dataset.index = index;
            // Add droppable handlers
            this.makeDroppable(slot, 'sorting');
            this.sortingArea.appendChild(slot);
        });

        // Create 4 Tableau Columns (align with sorting slots)
        this.tableauArea.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const col = document.createElement('div');
            col.className = 'tableau-column';
            col.dataset.index = i;

            // Base area for dropping when empty
            const base = document.createElement('div');
            base.className = 'slot-base';
            this.makeDroppable(base, 'tableau', i);

            col.appendChild(base);
            this.tableauArea.appendChild(col);
        }

        // Graveyard click to draw
        this.graveyard.onclick = () => this.game.drawCard();
    }

    update(state) {
        this.turnsValue.textContent = state.turnsLeft;

        // 1. Render Sorting Slots
        const sortSlots = document.querySelectorAll('.sorting-slot');
        sortSlots.forEach((slot, i) => {
            const pile = state.sortingSlots[i];
            // Clear existing cards in UI slot (except the slot element itself)
            // But we need to keep the slot element.
            // Simple approach: clear innerHTML and re-append top card if exists?
            // Or just show the top card.
            // Requirement: "Stack cards... last placed card is shown". 
            // We can just render the top card.

            // Remove old card elements
            const existingCard = slot.querySelector('.card');
            if (existingCard) existingCard.remove();

            if (pile.length > 0) {
                const topCard = pile[pile.length - 1];
                const cardEl = this.createCardElement(topCard);
                // Disable dragging from sorting slot? Usually allowed in Solitaire.
                // Let's allow it for now.
                cardEl.dataset.sourceType = 'sorting';
                cardEl.dataset.sourceIndex = i;
                slot.appendChild(cardEl);
            }
        });

        // 2. Render Tableau
        const tableauCols = document.querySelectorAll('.tableau-column');
        tableauCols.forEach((col, i) => {
            const pile = state.tableauSlots[i];
            // Remove all .card elements, keep .slot-base
            const cards = col.querySelectorAll('.card');
            cards.forEach(c => c.remove());

            pile.forEach((card, cardIndex) => {
                const cardEl = this.createCardElement(card);
                cardEl.style.top = `${cardIndex * 30}px`; // Visual offset (cascade)
                cardEl.style.zIndex = cardIndex + 1;

                cardEl.dataset.sourceType = 'tableau';
                cardEl.dataset.sourceIndex = i;
                cardEl.dataset.cardIndex = cardIndex;

                // Only the top card is draggable? Or any?
                // Standard Solitaire: can drag stack. 
                // Simplified: Only top card for now.
                if (cardIndex === pile.length - 1) {
                    cardEl.draggable = true;
                } else {
                    // If we implement stack drag later. For now only top.
                    cardEl.draggable = false;
                    cardEl.style.cursor = 'default';
                }

                col.appendChild(cardEl);
            });
        });

        // 3. Render Graveyard (Deck)
        // Show discard pile top? Or just a "Deck" to click?
        // User requirements: "Card Graveyard" -> "Cards are piled up".
        // "Remaining turns" is separate.
        // Assuming Graveyard is the draw pile? Or User meant "Discard Pile"?
        // "UI: ... Card Graveyard ... same line ... Sorting Slots ... Remaining Turns"
        // Usually Graveyard means Discard. But where is the Draw pile? 
        // "Card Graveyard" might BE the Draw pile in this context (where you dig/draw from).
        // Let's treat it as the Draw Deck.

        // Clean graveyard visual
        const prevCards = this.graveyard.querySelectorAll('.card');
        prevCards.forEach(c => c.remove());

        if (state.graveyard.length > 0) {
            const topCard = state.graveyard[state.graveyard.length - 1];
            // If we treat Graveyard as Discard, we show face up.
            // If it's a Draw pile, face down?
            // "Card Graveyard" usually implies tossed cards. 
            // But "Turns" implies we draw from somewhere.
            // Let's assume: Deck (Hidden) -> Click -> Graveyard (Visible) -> Drag to board.
            // Or Deck -> Hand. 
            // Let's implement: Click Deck (if visible) -> Moves to a visible 'Open' pile?
            // User said: [Card Graveyard].
            // Let's assume the pile IS the draw source. 
            // If it's a "Graveyard" maybe it's face up?
            // Let's render the top card of the graveyard if it exists.
            const cardEl = this.createCardElement(topCard);
            cardEl.dataset.sourceType = 'graveyard';
            this.graveyard.appendChild(cardEl);
        } else {
            // Empty placeholder
            if (state.deck.length === 0) {
                this.graveyard.innerHTML = '<div class="card-placeholder">EMPTY</div>';
            }
        }
    }

    createCardElement(card) {
        const el = document.createElement('div');
        el.className = `card ${card.type === 'KEY' ? 'key-card' : ''}`;
        el.draggable = true;
        el.dataset.id = card.id;

        // Style based on category
        const color = this.game.categories[card.category].color;
        el.style.borderColor = color;
        // Background color tint?
        el.style.background = `linear-gradient(135deg, white 0%, ${color}22 100%)`;

        // Content
        el.textContent = card.label; // Icon or Text

        // Drag Events
        el.addEventListener('dragstart', (e) => this.handleDragStart(e, card));

        return el;
    }

    makeDroppable(el, type, index = -1) {
        el.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
            el.style.borderColor = 'white'; // Highlight
        });

        el.addEventListener('dragleave', (e) => {
            el.style.borderColor = ''; // Reset
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.style.borderColor = '';
            const cardId = e.dataTransfer.getData('text/plain');
            this.game.handleDrop(cardId, type, index);
        });
    }

    handleDragStart(e, card) {
        this.draggedCard = card;
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
        // Source checking is done via dataset on the element in update()
    }

    attachGlobalListeners() {
        // Any global keys or clicks
    }
}
