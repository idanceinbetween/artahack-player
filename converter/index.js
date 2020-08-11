const fs = require("fs");
const { promisify } = require("util");
const { join, resolve } = require("path");

const readdr = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const scanForColumnNamesExcFrame = (lines) => {
  const allColumnNames = new Set();
  for (let line of lines) {
    const cells = line.split(" ");
    const cellsAfterFrame = cells.slice(2);

    const columnNames = cellsAfterFrame.filter((x) => x.startsWith("/"));

    columnNames.forEach((columnName) => allColumnNames.add(columnName));
  }

  return allColumnNames;
};

const convertFileToColumns = async (filePath) => {
  const fileContents = await readFile(filePath, "utf8");

  const lines = fileContents.split("\n");

  const columnNames = scanForColumnNamesExcFrame(lines);

  const columns = {};

  const numberOfFrames = +lines[lines.length - 2].split(" ")[1];

  const columnEmptyFrames = [];
  for (let i = 0; i < numberOfFrames; i++) {
    columnEmptyFrames.push(null);
  }

  columnNames.forEach((columnName) => {
    columns[columnName] = columnEmptyFrames.slice();
  });

  lines.forEach((line) => {
    const entries = line.replace("\r", "").split(" ");

    const frameIndex = +entries[1] - 1;

    columnNames.forEach((columnName) => {
      const columnIndex = entries.indexOf(columnName);
      if (columnIndex >= 0) {
        let endingColumnIndex;

        for (let i = columnIndex + 1; i < entries.length; i++) {
          if (entries[i].startsWith("/")) {
            break;
          }

          endingColumnIndex = i;
        }

        const dataForEntry = entries.slice(
            columnIndex + 1,
            endingColumnIndex + 1
        );

        columns[columnName][frameIndex] = dataForEntry.map((x) => +x);
      }
    });
  });

  return columns;
};

const convertToOnlyContainLastValue = (columns) => {
  return Object.entries(columns).reduce((acc, [columnName, values]) => {
    acc[columnName] = values.map((valuesArray) => {
      if (!valuesArray) return null;

      return valuesArray[valuesArray.length - 1];
    });

    return acc;
  }, {});
};

const fillSparse = (columns) => {
  return Object.entries(columns).reduce((acc, [columnName, values]) => {
    let lastValue = 0;
    acc[columnName] = values.map((value) => {
      if (!value) return lastValue;
      lastValue = value;
      return value;
    });

    return acc;
  }, {});
};

const prepareFiles = async () => {
  const targetDirectory = process.env.DIR
      ? process.env.DIR
      : resolve(__dirname, "../data");

  const files = await readdr(targetDirectory);

  const textFiles = files.filter((x) => x.endsWith("txt"));
  return { targetDirectory, textFiles };
};

const convertFileToColumnsIncFrameAndCondensed = async (filePath) => {
  const fileContents = await readFile(filePath, "utf8");

  const lines = fileContents.split("\n");

  const nonEmptyFrames = await extractNonEmptyFrames(lines);
  const columnNamesIncFrame = scanForColumnNamesIncFrame(nonEmptyFrames);

  const columns = {};

  const numberOfNonEmptyFrames = nonEmptyFrames.length;
  const columnEmptyFrames = createArrayWithNullValuesInNumberOfNonEmptyFrames(
      numberOfNonEmptyFrames
  );

  createSetWithColumnNameAsKeyAndPlaceholderNullValuesForEachFrame(
      columnNamesIncFrame,
      columns,
      columnEmptyFrames
  );

  for (let i = 0; i < nonEmptyFrames.length; i++) {
    // creates an entries array out of given frame
    const entries = nonEmptyFrames[i].replace("\r", "").split(" ");

    columnNamesIncFrame.forEach((columnName) => {
      // find the index of a column name in entries array of the given frame
      // 'frame' column will always be index 0, others will vary
      const columnIndex = entries.indexOf(columnName);

      const aColumnHasDataInThisFrame = columnIndex >= 0;

      if (aColumnHasDataInThisFrame) {
        //eg 'frame' column will always land in here

        // find index of the last value of that column in entries array so we know where to slice
        let endingColumnIndex;
        for (let i = columnIndex + 1; i < entries.length; i++) {
          if (entries[i].startsWith("/")) {
            break;
          }

          endingColumnIndex = i;
        }

        // creates a string array for the values that needs to be inserted into that column
        const dataForEntry = entries.slice(
            columnIndex + 1,
            endingColumnIndex + 1
        );

        columns[columnName][i] = dataForEntry.map((x) => +x);
      }
    });
  }

  return columns;
};

const scanForColumnNamesIncFrame = (lines) => {
  const allColumnNames = new Set();
  for (let line of lines) {
    const cells = line.split(" ");

    const columnNames = cells.filter((x) => x.startsWith("/"));

    columnNames.forEach((columnName) => allColumnNames.add(columnName));
  }

  return allColumnNames;
};

const extractNonEmptyFrames = (lines) => {
  const filledRows = [];
  lines.forEach((line) => {
    if (line.includes("EmotiBit")) {
      filledRows.push(line);
    }
  });
  return filledRows;
};

function createArrayWithNullValuesInNumberOfNonEmptyFrames(numberOfFrames) {
  const columnEmptyFrames = [];
  for (let i = 0; i < numberOfFrames; i++) {
    columnEmptyFrames.push(null);
  }
  return columnEmptyFrames;
}

function createSetWithColumnNameAsKeyAndPlaceholderNullValuesForEachFrame(
    columnNamesIncFrame,
    columns,
    columnEmptyFrames
) {
  columnNamesIncFrame.forEach((columnName) => {
    columns[columnName] = columnEmptyFrames.slice();
  });
}

const convertToCsv = (columns, delimiter) => {
  const columnNames = Object.keys(columns);

  const numberOfRows = columns[columnNames[0]].length;

  const result = [];
  result.push(columnNames);

  for (let rowIndex = 0; rowIndex < numberOfRows; rowIndex++) {
    const rowContents = columnNames.map(
        (columnName) => columns[columnName][rowIndex]
    );

    result.push(rowContents);
  }

  return result.map((row) => row.join(delimiter)).join("\n");
};
const createCsv = async (targetDirectory, fileName, preparedValues, delimiter) => {
  await writeFile(
      join(targetDirectory, `${fileName}.csv`),
      convertToCsv(preparedValues, delimiter)
  );
};

const main = async () => {
  const { targetDirectory, textFiles } = await prepareFiles();

  console.log("processing files:", textFiles);

  for (const textFile of textFiles) {
    const fullPath = join(targetDirectory, textFile);
    const fileName = textFile.split(".")[0];

    const asColumns = await convertFileToColumns(fullPath);
    const asColumnsForV3 = await convertFileToColumnsIncFrameAndCondensed(fullPath);

    const withLastValueOnlySparsed = convertToOnlyContainLastValue(asColumns);

    const SPACE_DELIMITER = " ";
    const COMMA_DELIMITER = ", ";

    await createCsv(targetDirectory, `${fileName}_sparse`, withLastValueOnlySparsed, SPACE_DELIMITER);

    const withSparseFilledV2 = fillSparse(withLastValueOnlySparsed);
    await createCsv(targetDirectory, `${fileName}_filled`, withSparseFilledV2, SPACE_DELIMITER);

    const withFrameAndCondensedV3 = convertToOnlyContainLastValue(
        asColumnsForV3
    );
    await createCsv(targetDirectory, `${fileName}_withFrame`, withFrameAndCondensedV3, COMMA_DELIMITER);
  }
};

main();
