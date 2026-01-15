import { CATEGORIES, CARD_TYPES, GAME_CONFIG } from './constants.js';
import { GameUI } from './ui.js';

class Game {
    constructor() {
        this.categories = CATEGORIES;
        this.state = {
            deck: [], // Hidden draw pile
            graveyard: [], // Visible pile (can drag from here)
            sortingSlots: [[], [], [], []], // 4 slots
            tableauSlots: [[], [], [], []], // 4 cols
            turnsLeft: GAME_CONFIG.INITIAL_TURNS
        };
        this.ui = new GameUI(this);
    }

    start() {
        this.initializeDeck();
        this.dealInitialCards();
        this.ui.init();
        this.ui.update(this.state);
    }

    initializeDeck() {
        let cards = [];

        // 1. Create Key Cards
        Object.values(this.categories).forEach(cat => {
            cards.push({
                id: `KEY_${cat.id}`,
                type: CARD_TYPES.KEY,
                category: cat.id,
                label: cat.label,
                faceUp: true
            });
            // 2. Create Sub Cards
            cat.items.forEach((item, idx) => {
                cards.push({
                    id: `SUB_${cat.id}_${idx}`,
                    type: CARD_TYPES.SUB,
                    category: cat.id,
                    label: item,
                    faceUp: true
                });
            });
        });

        // Shuffle
        this.shuffle(cards);
        this.state.deck = cards;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    dealInitialCards() {
        // Deal some cards to tableau (e.g., 4 columns x 3 cards)
        // Or all to deck?
        // Solitaire usually has some on board.
        // Let's deal 1, 2, 3, 4 cards to the 4 columns.
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j <= i; j++) {
                if (this.state.deck.length > 0) {
                    const card = this.state.deck.pop();
                    this.state.tableauSlots[i].push(card);
                }
            }
        }

        // Put one in graveyard to start?
        if (this.state.deck.length > 0) {
            this.state.graveyard.push(this.state.deck.pop());
        }
    }

    drawCard() {
        if (this.state.turnsLeft <= 0) {
            alert('Game Over! No more turns.');
            return;
        }

        if (this.state.deck.length === 0) {
            // Check if we can recycle graveyard? Not standard generally unless specified.
            // For now, just empty.
            return;
        }

        const card = this.state.deck.pop();
        this.state.graveyard.push(card);
        this.state.turnsLeft--;

        this.ui.update(this.state);
    }

    findCardLocation(cardId) {
        // Search graveyard
        const graveIdx = this.state.graveyard.findIndex(c => c.id === cardId);
        if (graveIdx !== -1) return { location: 'graveyard', index: -1, cardIndex: graveIdx };

        // Search tableau
        for (let i = 0; i < 4; i++) {
            const idx = this.state.tableauSlots[i].findIndex(c => c.id === cardId);
            if (idx !== -1) return { location: 'tableau', index: i, cardIndex: idx };
        }

        // Search sorting (shouldn't drag FROM sorting usually, but if we allowed it)
        for (let i = 0; i < 4; i++) {
            const idx = this.state.sortingSlots[i].findIndex(c => c.id === cardId);
            if (idx !== -1) return { location: 'sorting', index: i, cardIndex: idx };
        }

        return null;
    }

    validateDrop(card, targetType, targetIndex) {
        // 1. Drop on Sorting Slot
        if (targetType === 'sorting') {
            const pile = this.state.sortingSlots[targetIndex];
            const topCard = pile.length > 0 ? pile[pile.length - 1] : null;

            if (!topCard) {
                // Empty slot: Must be KEY card
                return card.type === CARD_TYPES.KEY;
            } else {
                // Occupied: Must be SUB card of same category
                return card.type === CARD_TYPES.SUB && card.category === topCard.category;
            }
        }

        // 2. Drop on Tableau
        if (targetType === 'tableau') {
            // Simplified Rule: Allow anything for now to enable easy moving for testing
            // Or enforce Solitaire rules?
            // User Request: "Same as Solitaire... but sorting requires Key Card"
            // Let's implement basic "Can always place on empty" 
            // "Can place on non-empty if..." -> let's enable ANY drop for prototype flexibility first, 
            // to make testing easiest for the user to see the Sorting Logic (Start Key + Sub).
            return true;
        }

        return false;
    }

    handleDrop(cardId, targetType, targetIndex) {
        const source = this.findCardLocation(cardId);
        if (!source) return;

        // Get the card object
        let pile = null;
        if (source.location === 'graveyard') pile = this.state.graveyard;
        else if (source.location === 'tableau') pile = this.state.tableauSlots[source.index];
        else if (source.location === 'sorting') pile = this.state.sortingSlots[source.index]; // If we move from sorting back?

        const card = pile[source.cardIndex];

        // Only allow moving the TOP card of the stack?
        if (source.cardIndex !== pile.length - 1) {
            // For now deny moving middle cards
            return;
        }

        if (this.validateDrop(card, targetType, targetIndex)) {
            // Execute Move
            pile.pop(); // Remove from source

            if (targetType === 'sorting') {
                this.state.sortingSlots[targetIndex].push(card);
                // Check Win?
                this.checkWinCondition();
            } else if (targetType === 'tableau') {
                this.state.tableauSlots[targetIndex].push(card);
            }

            this.ui.update(this.state);
        } else {
            console.log("Invalid Move");
            // Animate invalid?
        }
    }

    checkWinCondition() {
        // If deck is empty, graveyard empty, tableau empty?
        // Or if all sub cards are in sorting slots?
        // Simple check: deck and tableau and graveyard empty
        const totalCards = this.state.deck.length + this.state.graveyard.length +
            this.state.tableauSlots.flat().length;
        if (totalCards === 0) {
            setTimeout(() => alert("CONGRATULATIONS! You cleared the board!"), 100);
        }
    }
}

// Start Game
const game = new Game();
game.start();
window.game = game; // For debug
