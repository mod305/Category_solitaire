// Main Game Logic
import { CATEGORIES_POOL } from './categories.js';
import { GameUI } from './ui.js';

const CARD_TYPES = {
    KEY: 'KEY',
    SUB: 'SUB'
};

class Game {
    constructor() {
        // We don't init deck here, we do it in start() with randomization
        this.state = {
            deck: [],
            openPile: [],
            sortingSlots: [[], [], [], []],
            tableauSlots: [[], [], [], []],
            turnsLeft: 0
        };
        this.activeCategories = {}; // Stores the config for the current game
        this.ui = new GameUI(this);
        this.difficulty = 'NORMAL';
    }

    setDifficulty(diff) {
        this.difficulty = diff;
        this.setupGame(false);
        this.ui.update(this.state);
    }

    start() {
        this.setupGame(false); // First start: Normal (Default)
        this.ui.init();
        this.ui.update(this.state);
    }

    setupGame(randomizeDifficulty = false) {
        // Initialize difficulty logic
        const difficulties = ['EASY', 'NORMAL', 'HARD', 'EXTREME'];

        // If randomize requested OR difficulty is logicially missing/invalid, pick random
        if (randomizeDifficulty || !this.difficulty) {
            this.difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
        }

        let catMultiplier = 1.5;
        let turnMultiplier = 2.0;

        // User Specified Formulas:
        // Category Count = Sorting Slots (4) * Percentage
        // Turns = Min Turns * Multiplier
        // Min Turns = Cards in Deck (Total - Tableau)
        switch (this.difficulty) {
            case 'EASY':
                catMultiplier = 1.3; // 4 * 1.3 = 5.2 -> 5
                turnMultiplier = 2.0;
                break;
            case 'NORMAL':
                catMultiplier = 1.3; // 4 * 1.3 = 5.2 -> 5
                turnMultiplier = 1.5;
                break;
            case 'HARD':
                catMultiplier = 1.5; // 4 * 1.5 = 6
                turnMultiplier = 1.0;
                break;
            case 'EXTREME':
                catMultiplier = 2.0; // 4 * 2.0 = 8
                turnMultiplier = 1.0;
                break;
            default:
                catMultiplier = 1.3;
                turnMultiplier = 1.5;
        }

        const numCats = Math.floor(4 * catMultiplier);

        console.log(`[Game] Setup ${this.difficulty}: Cats=${numCats}, TurnMult=${turnMultiplier}`);

        // 1. Randomize Category Selection
        const poolKeys = Object.keys(CATEGORIES_POOL);

        // Shuffle pool keys
        for (let i = poolKeys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [poolKeys[i], poolKeys[j]] = [poolKeys[j], poolKeys[i]];
        }

        const safeNumCats = Math.min(numCats, poolKeys.length);
        const selectedKeys = poolKeys.slice(0, safeNumCats);

        // 2. Setup Active Categories
        this.activeCategories = {};
        let totalCards = 0;

        selectedKeys.forEach(key => {
            const template = CATEGORIES_POOL[key];

            // Random Item Count (3 to 8)
            let itemCount = 3 + Math.floor(Math.random() * 6);
            itemCount = Math.min(itemCount, template.items.length);

            // Image Mode Change (20%)
            const isImageMode = Math.random() < 0.2;

            this.activeCategories[key] = {
                ...template,
                itemCount: itemCount,
                isImageMode: isImageMode,
                activeItems: template.items.slice(0, itemCount),
                activeEmojis: template.emojis ? template.emojis.slice(0, itemCount) : []
            };
            totalCards += (1 + itemCount); // 1 Key + Items
        });

        // 3. Initialize Deck (Create Card Objects)
        this.initializeDeck();
        // Note: Deck is created but not dealt. totalCards is accurate.

        // 4. Deal (Must deal BEFORE calc to set up initial state)
        this.dealInitialCards();

        // 5. Calculate Turns based on Perfect Play Simulation
        console.log("[Turn Calc] Starting Perfect Play Simulation...");
        // Emergency Bypass
        const minTurns = this.calculateMinimumTurns();

        // Additive Buffer Calculation
        // Formula: MinTurns + (TotalCards * Multiplier)?? 
        // No, user just said "Multiplier". Usually Min * Multiplier.
        // Let's use exactly that.
        this.state.turnsLeft = Math.ceil(minTurns * turnMultiplier);

        console.log(`[Game] Setup ${this.difficulty}: Turns=${this.state.turnsLeft} (Sim ${minTurns} * ${turnMultiplier})`);
    }

    initializeDeck() {
        let cards = [];
        Object.values(this.activeCategories).forEach(cat => {
            // Key Card
            cards.push({
                id: `KEY_${cat.id}`,
                type: CARD_TYPES.KEY,
                category: cat.id,
                label: cat.label,
                emoji: '🔑' // Key emoji? Or just label
            });

            // Sub Cards
            cat.activeItems.forEach((item, idx) => {
                cards.push({
                    id: `SUB_${cat.id}_${idx}`,
                    type: CARD_TYPES.SUB,
                    category: cat.id,
                    label: item,
                    emoji: cat.activeEmojis[idx] || item // Fallback
                });
            });
        });
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
        this.state.tableauSlots = [[], [], [], []]; // Ensure clear

        const totalCards = this.state.deck.length;
        const dealCount = Math.floor(totalCards * 0.4); // 40%

        // Distribute cards round-robin
        for (let k = 0; k < dealCount; k++) {
            if (this.state.deck.length > 0) {
                const card = this.state.deck.pop();
                const colIndex = k % 4;
                this.state.tableauSlots[colIndex].push(card);
            }
        }

        // Set Face Up for the last card in each column
        this.state.tableauSlots.forEach(pile => {
            if (pile.length > 0) {
                // Reset all to face down first (default is undefined/false)
                pile.forEach(c => c.faceUp = false);
                // Set top to face up
                pile[pile.length - 1].faceUp = true;
            }
        });
    }

    // --- SIMULATION FOR DIFFICULTY CALCULATION ---
    calculateMinimumTurns() {
        // 1. Deep Clone State for Simulation
        // We need to simulate: Deck, Tableau, Sorting, OpenPile, Collected Keys
        let simDeck = JSON.parse(JSON.stringify(this.state.deck)); // Current Deck (after deal)
        let simTableau = JSON.parse(JSON.stringify(this.state.tableauSlots));
        let simSorting = [[], [], [], []]; // 4 Empty Sorting Slots
        let simOpenPile = [];

        // Removed unused variable collectedKeys

        let turns = 0;
        // Removed unused variable moves

        let maxcycles = 5; // Reduced Safety break
        let cycle = 0;

        // Helper: Check if card can go to Sorting
        const canSort = (card) => {
            // Specific Logic:
            // Find a slot that accepts this card.
            // Case A: Key Card. Needs an empty slot.
            if (card.type === 'KEY') {
                return simSorting.some(slot => slot.length === 0);
            }
            // Case B: Sub Card. Needs a slot with matching Category.
            if (card.type === 'SUB') {
                return simSorting.some(slot => slot.length > 0 && slot[0].category === card.category);
            }
            return false;
        };

        const doSort = (card) => {
            if (card.type === 'KEY') {
                const emptyIdx = simSorting.findIndex(s => s.length === 0);
                if (emptyIdx !== -1) simSorting[emptyIdx].push(card);
            } else {
                const matchIdx = simSorting.findIndex(s => s.length > 0 && s[0].category === card.category);
                if (matchIdx !== -1) simSorting[matchIdx].push(card);
            }
            // Check Completion (Optional for sim, just keep sorting)
            // In real game, completed slots empty. In sim, we can just keep stacking or clear.
            // Clearing helps finding empty slots for NEW Keys.
            // Check if pile is full (Key + Items).
            simSorting.forEach((pile, idx) => {
                if (pile.length > 0) {
                    const k = pile[0];
                    const config = this.activeCategories[k.category];
                    if (pile.length === (config.itemCount + 1)) {
                        simSorting[idx] = []; // Clear logic
                    }
                }
            });
        };

        // Simulation Loop
        while (cycle < maxcycles) {
            let progressMade = false;

            // Phase 1: Tableau Consoldiation & Auto-Play
            // Continually check if any top card of Tableau can go to Sorting OR other Tableau
            let tableuChanged = true;
            let safetyLimit = 0;
            while (tableuChanged && safetyLimit < 50) {
                tableuChanged = false;
                safetyLimit++;

                // 1a. Tableau -> Sorting
                for (let i = 0; i < 4; i++) {
                    const col = simTableau[i];
                    if (col.length > 0) {
                        const top = col[col.length - 1];
                        if (canSort(top)) {
                            doSort(col.pop());
                            tableuChanged = true;
                            progressMade = true;
                            continue; // Restart loop to see if new top is sortable
                        }
                    }
                }
                if (tableuChanged) continue;

                // 1b. Tableau -> Tableau (Consolidation)
                // Move card from Col A to Col B if it helps (stacks matching category).
                // This reduces waste significantly.
                for (let i = 0; i < 4; i++) {
                    const sourceCol = simTableau[i];
                    if (sourceCol.length > 0) {
                        const card = sourceCol[sourceCol.length - 1];

                        // Try finding a target col with matching top
                        for (let j = 0; j < 4; j++) {
                            if (i === j) continue;
                            const targetCol = simTableau[j];

                            if (targetCol.length > 0) {
                                const targetTop = targetCol[targetCol.length - 1];
                                if (targetTop.type !== 'KEY' && targetTop.category === card.category) {
                                    // Valid Merge!
                                    // Anti-Ping-Pong Logic:
                                    // Only move if we are exposing something new or emptying a column.
                                    // If sourceCol has another card of SAME category underneath, moving does nothing but loop.
                                    let helpful = true;
                                    if (sourceCol.length > 1) {
                                        const underCard = sourceCol[sourceCol.length - 2];
                                        if (underCard.type === 'SUB' && underCard.category === card.category) {
                                            helpful = false; // Moving top matching card to another matching pile is circular
                                        }
                                    }

                                    if (helpful) {
                                        targetCol.push(sourceCol.pop());
                                        tableuChanged = true;
                                        progressMade = true;
                                        break; // Break inner, restart outer
                                    }
                                }
                            }
                        }
                        if (tableuChanged) break;
                    }
                }
            }

            // Check Win
            const allTableauEmpty = simTableau.every(c => c.length === 0);
            const deckEmpty = simDeck.length === 0 && simOpenPile.length === 0;
            // Note: Sorting slots empty is win condition IF others empty.
            // Simplified: If deck and tableau empty, we win.
            if (allTableauEmpty && deckEmpty) {
                break;
            }

            // Phase 2: Draw
            if (simDeck.length === 0) {
                if (simOpenPile.length > 0) {
                    // Recycle
                    simDeck = simOpenPile.reverse();
                    simOpenPile = [];
                    cycle++;
                    if (cycle >= maxcycles) break;
                } else {
                    break; // Deadlock or Win
                }
            }

            if (simDeck.length > 0) {
                const card = simDeck.pop();
                turns++;

                // Logic:
                // 1. Can Sort directly?
                if (canSort(card)) {
                    doSort(card);
                    progressMade = true;
                }
                // 2. Can Slot in Tableau? (Optimize: Only if needed?)
                // Perfect Play Strategy: Always keep Tableau slots full to dig deep?
                // Or only hold if Key not ready?
                // Simple Heuristic: If we can't sort, put in Tableau if possible.
                // If Tableau full, put in OpenPile.
                else {
                    // Try Tableau
                    // Priority: Empty Columns? or just any?
                    // Solitaire logic: Avoid blocking deep columns. But here columns are stacks.
                    // Just finding first available spot.
                    // BUT: Game rule usually restricts placing on Tableau?
                    // Valid Drop: "Cannot place on KEY", "Must match category".
                    // Wait, Real Game Rule: 'validateDrop' -> 'Target must match category'.
                    // This means we CANNOT just place any card in Tableau.
                    // We can only stack cards of SAME CATEGORY.
                    // And Empty Column accepts ANY card.

                    // Let's check Tableau placement rules for Simulation.
                    let placed = false;

                    // A. Try to stack on existing matching category
                    for (let i = 0; i < 4; i++) {
                        const col = simTableau[i];
                        if (col.length > 0) {
                            const top = col[col.length - 1];
                            if (top.type !== 'KEY' && top.category === card.category) {
                                col.push(card);
                                placed = true;
                                break;
                            }
                        }
                    }

                    // B. If not placed, Try Empty Column
                    if (!placed) {
                        const emptyColIdx = simTableau.findIndex(c => c.length === 0);
                        if (emptyColIdx !== -1) {
                            simTableau[emptyColIdx].push(card);
                            placed = true;
                        }
                    }

                    // C. Failed to Place -> Open Pile (Waste)
                    if (!placed) {
                        simOpenPile.push(card);
                    }
                }
            }
        }

        console.log(`[Simulation] Cycles: ${cycle}, Est Turns: ${turns}`);
        return turns > 0 ? turns : 50; // Safety fallback
    }

    restart() {
        if (confirm("게임을 재시작하시겠습니까? (난이도가 무작위로 변경됩니다)")) {
            this.state = {
                deck: [],
                openPile: [],
                sortingSlots: [[], [], [], []],
                tableauSlots: [[], [], [], []],
                turnsLeft: 0,
                gameOver: false
            };
            this.setupGame(true); // Restart = Random Difficulty
            this.ui.update(this.state);
        }
    }

    drawCard() {
        if (this.state.turnsLeft <= 0) {
            alert('남은 턴이 없습니다.');
            return;
        }

        if (this.state.deck.length === 0) {
            if (this.state.openPile.length > 0) {
                // Recycle: Move openPile back to deck (reversed)
                this.state.deck = [...this.state.openPile].reverse();
                this.state.openPile = [];
                // Don't consume turn on recycle? Or do? 
                // Standard Solitaire: Recycling prevents stalemate. Usually free or limited.
                // User didn't specify cost, let's make it free action but consume turn on Draw.
                this.ui.update(this.state);
                return;
            } else {
                return; // Both empty
            }
        }

        const card = this.state.deck.pop();
        this.state.openPile.push(card);
        this.state.turnsLeft--;

        this.ui.update(this.state);

        // Check for Game Over (failure) if turns ran out
        if (this.state.turnsLeft === 0) {
            setTimeout(() => alert("턴이 모두 소진되었습니다. (실패)"), 100);
        }
    }

    findCardLocation(cardId) {
        const openIdx = this.state.openPile.findIndex(c => c.id === cardId);
        if (openIdx !== -1) return { location: 'graveyard', index: -1, cardIndex: openIdx };

        for (let i = 0; i < 4; i++) {
            const idx = this.state.tableauSlots[i].findIndex(c => c.id === cardId);
            if (idx !== -1) return { location: 'tableau', index: i, cardIndex: idx };
        }

        for (let i = 0; i < 4; i++) {
            const idx = this.state.sortingSlots[i].findIndex(c => c.id === cardId);
            if (idx !== -1) return { location: 'sorting', index: i, cardIndex: idx };
        }
        return null;
    }

    validateDrop(card, targetType, targetIndex) {
        if (targetType === 'sorting') {
            const pile = this.state.sortingSlots[targetIndex];
            const topCard = pile.length > 0 ? pile[pile.length - 1] : null;

            if (!topCard) {
                return card.type === CARD_TYPES.KEY;
            } else {
                return card.type === CARD_TYPES.SUB && card.category === topCard.category;
            }
        }

        if (targetType === 'tableau') {
            const pile = this.state.tableauSlots[targetIndex];
            if (pile.length === 0) return true;

            const topCard = pile[pile.length - 1];

            // Rule: Cannot place anything on a KEY card in Tableau
            if (topCard.type === CARD_TYPES.KEY) {
                return false;
            }

            // Otherwise, must match category
            return card.category === topCard.category;
        }
        return false;
    }

    handleDrop(cardId, targetType, targetIndex) {
        const source = this.findCardLocation(cardId);
        if (!source) return;

        let pile = null;
        if (source.location === 'graveyard') pile = this.state.openPile;
        else if (source.location === 'tableau') pile = this.state.tableauSlots[source.index];
        else if (source.location === 'sorting') pile = this.state.sortingSlots[source.index];

        const card = pile[source.cardIndex];

        // Restriction: For Graveyard, only top card can be moved.
        // For Tableau, we allow group dragging (middle cards), so we don't return here.
        if (source.location === 'graveyard' && source.cardIndex !== pile.length - 1) return;

        if (this.validateDrop(card, targetType, targetIndex)) {
            // Group Move: Take all cards from the grabbed index to the end
            const cardsToMove = pile.splice(source.cardIndex);

            // Update Source: If we moved from Tableau, reveal the new top card
            if (source.location === 'tableau' && pile.length > 0) {
                pile[pile.length - 1].faceUp = true;
            }

            // Essential: Ensure all moved cards are Face Up
            cardsToMove.forEach(c => c.faceUp = true);

            // Add to Target
            if (targetType === 'sorting') {
                this.state.sortingSlots[targetIndex].push(...cardsToMove);

                // Check for Category Completion (Slot Recycling)
                const currentPile = this.state.sortingSlots[targetIndex];
                if (currentPile.length > 0) {
                    const keyCard = currentPile[0];
                    const config = this.activeCategories[keyCard.category];

                    // Key + All Items
                    if (currentPile.length === (config.itemCount + 1)) {
                        // Clear slot immediately as per rules
                        this.state.sortingSlots[targetIndex] = [];
                    }
                }

                this.checkWinCondition();
            } else if (targetType === 'tableau') {
                this.state.tableauSlots[targetIndex].push(...cardsToMove);
            }

            this.ui.update(this.state);
        }
    }

    getCollectedCount(catId) {
        const slotIndex = this.state.sortingSlots.findIndex(pile => {
            if (pile.length > 0) return pile[0].category === catId;
            return false;
        });

        if (slotIndex === -1) return 0;
        // Subtract 1 because first card is KEY
        return Math.max(0, this.state.sortingSlots[slotIndex].length - 1);
    }

    checkWinCondition() {
        const totalCards = this.state.deck.length + this.state.openPile.length +
            this.state.tableauSlots.flat().length;
        if (totalCards === 0) {
            setTimeout(() => alert("축하합니다! 모든 카드를 정리했습니다!"), 100);
        }
    }
}

// Start Game
const game = new Game();
game.start();
window.game = game; // For debug
