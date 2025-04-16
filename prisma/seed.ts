import prisma from "../src/config/prismaClient";
import books from "../books.json";


const seedDB = async () => {
  try {
    //@ts-ignore
    console.log("length of book", books.length);
    const jsonFilePath = "bookeverclean.json";
    //@ts-ignore
    const newBooks = books.slice(287, 500).map(async (book) => {
      const {
        bookId,
        coverImg,
        setting,
        bbeScore,
        bbeVotes,
        price,
        ratingsByStars,
        likedPercent,
        publishDate,
        characters,
        genres,
        title,
        pages,
        firstPublishDate,
        awards,
        numRatings,
        rating,
        description,
        ...data
      } = book;
      const genresArray = JSON.parse(genres.replace(/'/g, '"'));

      // Get the first value of the array
      const firstGenre = genresArray[0] as string;
      // Clean the string
      let cleanedDescription = description
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "");

      const min = 200;
      const max = 400;
      const randomCopies = Math.floor(Math.random() * (max - min + 1)) + min;
      const newBook = {
        copies: randomCopies,
        availableCopies: randomCopies / 2,
        genre: firstGenre,
        description: cleanedDescription,
        summary: cleanedDescription.slice(0, 100),
        coverUrl: {
          public_id: "",
          size: 3433,
          format: "jpg",
          secure_url: coverImg,
        },
        year: extractYear(publishDate),
        title: title.replace("(Goodreads Author)", "").trim(),
        pages: parseInt(pages),
        ...data,
      };
      console.log("Inserting to prisma");

      await prisma.books.create({ data: newBook });
    });
  } catch (error) {
    console.log("error", error);
  }
};
//@ts-ignore
function extractYear(dateStr) {
  if (/[a-zA-Z]/.test(dateStr)) {
    // Handle "December 15th 2009"
    const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/, "$1");
    return new Date(cleaned).getFullYear();
  } else {
    // Assume "YY/MM/DD"
    const [yy, mm, dd] = dateStr.split("/");
    const fullYear = +yy < 50 ? 2000 + +yy : 1900 + +yy;
    return new Date(`${fullYear}-${mm}-${dd}`).getFullYear() || 2025;
  }
}


seedDB();
