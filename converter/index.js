const fs = require("fs");
const { promisify } = require("util");
const { join, resolve } = require("path");

const readdr = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const getTargetDirectory = () => {
  const currentDir = resolve(__dirname, "../data");
  return process.env.DIR || currentDir;
};

const scanForColumnNames = (lines) => {
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

  const columnNames = scanForColumnNames(lines);

  console.log(columnNames);

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

const DELIMITER = " ";
const convertToCsv = (columns) => {
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

  return result.map((row) => row.join(DELIMITER)).join("\n");
};

const main = async () => {
  const targetDirectory = getTargetDirectory();

  const files = await readdr(targetDirectory);

  const textFiles = files.filter((x) => x.endsWith("txt"));

  console.log("processing files:", textFiles);

  textFiles.forEach(async (textFile) => {
    const fullPath = join(targetDirectory, textFile);
    const asColumns = await convertFileToColumns(fullPath);

    const withLastValueOnly = convertToOnlyContainLastValue(asColumns);

    const fileName = textFile.split(".")[0];

    await writeFile(
      join(targetDirectory, `${fileName}_sparse.csv`),
      convertToCsv(withLastValueOnly)
    );

    const withSparseFilled = fillSparse(withLastValueOnly);

    await writeFile(
      join(targetDirectory, `${fileName}.csv`),
      convertToCsv(withSparseFilled)
    );
  });
};

main();
