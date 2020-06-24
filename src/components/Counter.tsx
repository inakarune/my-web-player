import React from 'react';
import Player from './Player';
import List from './List';
import firebase from 'firebase';
import config from '../config/firebase';
import './App.scss';

class Counter extends React.Component {
    public state = {
        count: 0,
        musicList: [],
        selectedSong: 'Unknown',
        url: ''
    }

    componentDidMount() {
        firebase.initializeApp(config);
        firebase.analytics();
        firebase.storage().ref('music/').listAll().then((result: any) => {
            this.setState({ musicList: result.items });
        });
    }

    private selectSong = (name: string): void => {
        firebase.storage().ref('music/' + name).getDownloadURL().then((url: string) => {
            this.setState({ selectedSong: name, url: url });
        });
    }
  
  
    render(): JSX.Element {
        return (
            <div className="player-container">
                <Player name={ this.state.selectedSong } url={ this.state.url } />
                <List list={ this.state.musicList } selectSong={ this.selectSong }/>
            </div>
        );
    }
}

export default Counter;
