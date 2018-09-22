# blaze-player | Zabava

**Very messy work in progress! Still flushing out ideas!**

## Design

All files are encrypted. 

Covers are AES256 JPG images
Media is MPEG-DASH Encrypted (AES128)

Data will be stored on remote server like: 

    bucket/
        covers/ 
            0000001
            0000002
            ...
        mpeg_dash/
            0000001/
                stream.mpd
                audio/<lang>/<type>/
                    init.mp4
                    seg-1.m4s 
                    ...
                video/<type>/
                    init.mp4
                    seg-1.m4s 
                    ...
            0000002/
            ...
            
            
Info about the files will be stored in a locally encrypted Mongo Database


    media_id: uuid
    media_name: string
    media_type: string  # (video / tv show/ audio?)
    series: string
    seasion: number
    auto_play_series: boolean
    episode: number
    encryption: {key_id: secret_key} #diff for audio?
    genres: []
    year: number
    date_added: date
    times_watched: number
    
    
     
    
    
    



