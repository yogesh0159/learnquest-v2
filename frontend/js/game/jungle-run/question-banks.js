/** Content banks (kept separate so teachers/parents can extend them without touching code). level 1..4 = easy..hard. */
export const SUBJECT_BANKS = {
  spelling: [
    ..."cat dog sun hat bus pen cup bed fox pig ant egg".split(" ").map((word) => ({ word, level: 1 })),
    ..."apple tiger mango house water table plant bread".split(" ").map((word) => ({ word, level: 2 })),
    ..."banana jungle monkey parrot rabbit window".split(" ").map((word) => ({ word, level: 3 })),
    ..."elephant squirrel crocodile".split(" ").map((word) => ({ word, level: 4 })),
  ],
  science: [
    { q: "Which animal gives us milk?", a: "Cow", wrong: ["Lion", "Snake", "Eagle"], level: 1 },
    { q: "What do plants need to grow?", a: "Sunlight", wrong: ["Candy", "Plastic", "Sand"], level: 1 },
    { q: "Which one can fly?", a: "Bird", wrong: ["Fish", "Dog", "Turtle"], level: 1 },
    { q: "What colour is the sky on a clear day?", a: "Blue", wrong: ["Green", "Pink", "Black"], level: 1 },
    { q: "Which animal lives in water?", a: "Fish", wrong: ["Cat", "Horse", "Monkey"], level: 1 },
    { q: "What do bees make?", a: "Honey", wrong: ["Bread", "Milk", "Juice"], level: 1 },
    { q: "Ice is frozen...", a: "Water", wrong: ["Milk", "Sand", "Air"], level: 2 },
    { q: "Which part of a plant is under the ground?", a: "Roots", wrong: ["Leaves", "Flowers", "Fruit"], level: 2 },
    { q: "Which planet do we live on?", a: "Earth", wrong: ["Mars", "Jupiter", "Venus"], level: 2 },
    { q: "How many legs does a spider have?", a: "8", wrong: ["6", "4", "10"], level: 2 },
    { q: "What do we use to see?", a: "Eyes", wrong: ["Ears", "Nose", "Hands"], level: 2 },
    { q: "Which is a mammal?", a: "Whale", wrong: ["Shark", "Frog", "Crab"], level: 3 },
    { q: "What gas do we breathe in?", a: "Oxygen", wrong: ["Helium", "Smoke", "Steam"], level: 3 },
    { q: "The Sun is a...", a: "Star", wrong: ["Planet", "Moon", "Cloud"], level: 3 },
    { q: "What do caterpillars become?", a: "Butterflies", wrong: ["Beetles", "Birds", "Bees"], level: 3 },
    { q: "Which is the biggest planet?", a: "Jupiter", wrong: ["Earth", "Mars", "Mercury"], level: 4 },
    { q: "Water boils at...", a: "100\u00b0C", wrong: ["50\u00b0C", "0\u00b0C", "20\u00b0C"], level: 4 },
  ],
  shapes: [
    { name: "triangle", sides: 3, level: 1 }, { name: "square", sides: 4, level: 1 }, { name: "circle", sides: 0, level: 1 }, { name: "rectangle", sides: 4, level: 1 },
    { name: "pentagon", sides: 5, level: 2 }, { name: "hexagon", sides: 6, level: 2 }, { name: "octagon", sides: 8, level: 3 }, { name: "line", sides: 1, level: 4 },
  ],
};
