import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import React, { useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { getSongList, getFavList, getBiliSeriesList, getBiliColleList, SearchSource } from '../background/DataProcess';
import { parseSearchSource } from '../utils/searchSource';

const SEARCH_ID = 'FavList-Search';

interface SearchResult {
  songList: any[];
  info: { title: string; id: string; source?: SearchSource };
}

interface SearchProps {
  handleSeach: (result: SearchResult) => void;
}

export const Search = function ({ handleSeach }: SearchProps) {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);

  const buildResult = (title: string, songs: any[], source?: SearchSource): SearchResult => ({
    songList: songs,
    info: { title, id: SEARCH_ID, source },
  });

  const runSearch = async (input: string) => {
    setLoading(true);
    try {
      const source = parseSearchSource(input) || (/^\d+$/.test(input) ? ({ type: 'fav', mid: input } satisfies SearchSource) : undefined);
      if (!source) {
        handleSeach(buildResult(`无法识别的搜索输入 - ${input}`, []));
        return;
      }

      if (source.type === 'bvid') {
        const songs = await getSongList(source.bvid);
        handleSeach(buildResult(`搜索视频 - ${source.bvid}`, songs, source));
        return;
      }

      if (source.type === 'fav') {
        const songs = await getFavList(source.mid);
        handleSeach(buildResult(`搜索收藏夹 - ${source.mid}`, songs, source));
        return;
      }

      if (source.type === 'series') {
        const songs = await getBiliSeriesList(source.mid, source.sid);
        handleSeach(buildResult(`搜索系列 - 用户${source.mid} / ${source.sid}`, songs, source));
        return;
      }

      const songs = await getBiliColleList(source.mid, source.sid);
      handleSeach(buildResult(`搜索合集 - 用户${source.mid} / ${source.sid}`, songs, source));
    } catch (error) {
      console.error(error);
      handleSeach(buildResult(`搜索失败 - ${input}`, []));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ gridArea: 'search', minWidth: 0, display: 'flex', alignItems: 'center' }}>
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          id='search-input'
          color='secondary'
          size='small'
          fullWidth
          label='粘贴 B 站网页链接 或 BVID'
          placeholder='例如：https://www.bilibili.com/video/BV... 或 BV1wr4y1v7TA'
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const input = searchValue.trim();
              if (input) {
                runSearch(input);
              }
            }
          }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchValue(e.target.value)}
          value={searchValue}
        />
        {loading ? <CircularProgress size={22} /> : null}
      </Box>
    </Box>
  );
};
