# Emotibit Data Utils for Art A Hack

Tools for playing back Emotibit data, for Art a Hack

## Convert Recorded Data to CSV

The folder in `converter` contains code to convert to csv.

For each text data file in a directory, creates 2 csvs:

* <filename>_sparse.csv - values for each sensor indexed by frame.  If values are missing will have null
* <filename>.csv - values for each sensor indexed by frame.  If values are missing use the last value

#### Setup

    cd converter

    npm install

#### Run

    cd converter

To create CSVs from all text files in the `./data` directory:

    node index.js

To specify a different data directory:

    On windows:

    $Env:DIR = "<data directory>"

    On mac/linux:

    export DIR="<data directory>"

Then run:

    node index.js

## Viewing the Data

The data viewer that is included runs using TouchDesigner.  To open it, [download TouchDesigner.](https://derivative.ca/download)  The non-commercial, free edition
will be sufficient to run this project.

For it to run on the data files, you first need to run the script above to convert the data files to csv.

Open the file DataViewer/DataViewer.toe in TouchDesigner, then press F1