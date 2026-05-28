import React, { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Box from '@mui/material/Box';

interface NewFavDialogProps {
  id?: string;
  onClose: (value?: string) => void;
  openState: boolean;
  defaultValue?: string;
}

export const NewFavDialog = function ({ onClose, openState, defaultValue = '' }: NewFavDialogProps) {
  const [favName, setFavName] = useState(defaultValue);

  const handleCancel = () => {
    onClose();
    setFavName('');
  };

  const handleOK = () => {
    const trimmed = favName.trim();
    if (!trimmed) return;
    onClose(trimmed);
    setFavName('');
  };

  return (
    <Dialog open={openState} onClose={handleCancel} fullWidth maxWidth='xs'>
      <DialogTitle>{defaultValue ? '重命名歌单' : '新建歌单'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin='dense'
          id='fav-name'
          label='歌单名称'
          fullWidth
          variant='standard'
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFavName(e.target.value)}
          value={favName}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') handleOK();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>取消</Button>
        <Button disabled={!favName.trim()} onClick={handleOK}>
          确认
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface FavInfo {
  id: string;
  title: string;
}

interface AddFavDialogProps {
  id?: string;
  onClose: (fromId?: string | null, toId?: string, songs?: any[]) => void;
  openState: boolean;
  fromId?: string | null;
  favLists: FavInfo[];
  songs: any[];
}

export const AddFavDialog = function ({ onClose, openState, fromId, favLists, songs }: AddFavDialogProps) {
  const [favId, setFavId] = useState('');
  const menuProps = {
    PaperProps: {
      style: {
        maxHeight: 320,
      },
    },
  };

  const availableFavs = useMemo(() => (favLists || []).filter((v) => v.id !== fromId), [favLists, fromId]);

  const handleCancel = () => {
    onClose();
    setFavId('');
  };

  const handleOK = () => {
    onClose(fromId, favId, songs);
    setFavId('');
  };

  return (
    <Dialog open={openState} onClose={handleCancel} fullWidth maxWidth='sm'>
      <DialogTitle>添加到歌单</DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ minWidth: 320 }}>
          <FormControl fullWidth>
            <InputLabel id='fav-select-label'>目标歌单</InputLabel>
            <Select
              labelId='fav-select-label'
              id='fav-select'
              value={favId}
              label='目标歌单'
              onChange={(e) => setFavId(String(e.target.value))}
              MenuProps={menuProps}
            >
              {availableFavs.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>取消</Button>
        <Button disabled={!favId} onClick={handleOK}>
          确认
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface HelpDialogProps {
  id?: string;
  onClose: () => void;
  openState: boolean;
}

export const HelpDialog = function ({ onClose, openState }: HelpDialogProps) {
  return (
    <Dialog open={openState} onClose={onClose} fullWidth maxWidth='md'>
      <DialogTitle>添加说明</DialogTitle>
      <DialogContent>
        <DialogContentText>目前支持导入 B 站的视频、收藏夹以及 UP 主合集：</DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>
          1. <strong>右键页面添加</strong>：在 B 站的视频页、收藏夹页或合集列表页内点击鼠标右键，使用插件菜单直接导入。
        </DialogContentText>
        <DialogContentText>
          2. <strong>右键链接添加</strong>：在网页上对着某个视频链接或封面右键，同样可以通过菜单快捷添加。
        </DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>
          3. <strong>直接粘贴链接</strong>：你也可以直接复制网页链接或 BVID (如 <code>BV1wr4y1v7TA</code>)，粘贴到上方的搜索栏中回车。
        </DialogContentText>
        <DialogContentText sx={{ mt: 2, p: 1, borderRadius: 1, bgcolor: 'rgba(171, 95, 255, 0.08)', fontSize: '0.85em' }}>
          <strong>💡 播放提示</strong>：部分高质量视频因 B 站分配了 P2P 节点 (MCDN)，在代理或特定网络下可能返回 404 导致无法播放。插件已内置自动搜索备份 CDN 的功能，如遇卡顿或报错，请尝试重新切歌或刷新插件。
        </DialogContentText>
        <DialogContentText sx={{ mt: 1, fontSize: '0.85em', opacity: 0.8 }}>
          注：当前仅支持哔哩哔哩 (bilibili) 来源
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

