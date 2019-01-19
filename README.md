# Zabava

Very private home media player for the cloud. 

Uses Encrypted MPEG-DASH videos, and even cover images are stored in AES-256.

**I AM NO LONGER USING OR UPDATING THIS CODE** 

I am willing to accept PRs into it, but I have no plans on support it in any way shape or form. This software is AS IS. 

## Supported Storage Providers 

Zabava has been desgined to have an agnostic storage provider backend for others to be dropped in as supported. 
Currently only the following have been written:

* Backblaze B2

## CLI 

```
$ zabava

Zabava - Manage media files

Options:

  -v, --version                 output the version number
  --verbose
  -h, --help                    output usage information

Commands:

  upload [options] <movieFile>  Upload, convert, and auto encrypt new media file
  delete <mediaId>              Remove an item
  list                          View list of movies
  resume [options]
```


```
$ zabava upload --help

  Usage: upload [options] <movieFile>
  
  Upload, convert, and auto encrypt new media file
  
  Options:
  
    -c, --cover [cover]                      Cover file
    -n, --movie-name [movie]                 Movie name (will use filename if omitted)
    -s, --subtitles [subtitles]              File for subtitles (srt format)
    -l, --subtitles-language [sub_language]  defaults to eng
    --do-not-delete                          Leave all build files
    -t, --media-type [media type]            movie, tv_show, anime, xxx
    --series [series]                        name of series, must provide episode number
    --season [season]                        Season number
    --episode [number]                       Episode number
    -a, --auto-play                          Autoplay the next item in the series
    -y, --yes                                Yes to all
    -h, --help                               output usage information

```


## Server

```
npm start
```

Navigate to localhost:3000 


## Design

* Covers are AES256 JPG images
* Media is MPEG-DASH Encrypted (AES128)
* Info about the files will be stored in a locally encrypted Mongo Database



