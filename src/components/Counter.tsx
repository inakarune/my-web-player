import React from 'react';
import Player from './Player';
import List from './List';
import firebase from 'firebase';
import config from '../config/firebase';
import './App.scss';

class Counter extends React.Component {
    public state: any = {
        count: 0,
        musicList: [],
        selectedSong: 'Unknown',
        url: '',
        currentIdx: 999
    }

    componentDidMount() {
        firebase.initializeApp(config);
        firebase.analytics();
        firebase.storage().ref('music/').listAll().then((result: any) => {
            this.setState({ musicList: result.items });
        });
    }

    private selectSong = (name: string, idx: number): void => {
        firebase.storage().ref('music/' + name).getDownloadURL().then((url: string) => {
            this.setState({ selectedSong: name, url: url, currentIdx: idx });
        });
    }

    private nextOrPrevious = (direction: string): void => {
        if (direction === 'next') {
            if (this.state.currentIdx >= this.state.musicList.length - 1) {
                this.selectSong(this.state.musicList[this.state.musicList.length - 1].name, this.state.musicList.length - 1);
            } else {
                this.selectSong(this.state.musicList[this.state.currentIdx + 1].name, this.state.currentIdx + 1);
            }
        } else {
            if (this.state.currentIdx <= 0) {
                this.selectSong(this.state.musicList[0].name, 0);
            } else {
                this.selectSong(this.state.musicList[this.state.currentIdx - 1].name, this.state.currentIdx - 1);
            }
        }
    }

    private deleteSong = (name: string): void => {
        if (prompt('비밀번호를 입력해주세요') === '2580') {
            firebase.storage().ref('music/' + name).delete().then(() => {
                console.log('delete song 1');
            });
        }
    }
  
    render(): JSX.Element {
        return (
            <div className="player-container">
                <Player name={ this.state.selectedSong } url={ this.state.url } nextSong={ this.nextOrPrevious }/>
                <List deleteSong={ this.deleteSong } list={ this.state.musicList } index={ this.state.currentIdx } selectSong={ this.selectSong }/>
            </div>
        );
    }
}

export default Counter;
