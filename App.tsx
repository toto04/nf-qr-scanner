import React, { Component } from 'react';
import { StyleSheet, Text, View, FlatList, SectionList, TouchableHighlight, Dimensions, Modal, Switch, Alert, TouchableOpacity, StatusBar } from 'react-native';
import { getStatusBarHeight } from 'react-native-status-bar-height'
import { Camera } from 'expo-camera'
import { BarCodeScanner } from 'expo-barcode-scanner'
import IconComponent from 'react-native-vector-icons/Ionicons'

interface GuestObject {
    anno: string,
    classe: string,
    cognome: string,
    id: string,
    id_persona: string,
    mail: string,
    nome: string,
    pagato: string,
    presente: string,
    telefono: string
}

interface ScanState {
    scanning: boolean,
    scanned: boolean,
    pending: boolean,
    paid?: boolean,
    adult?: boolean,
    present?: boolean,
    name?: string
}

class Header extends Component<{ title: string }> {
    render() {
        return <View style={{ alignSelf: 'stretch', padding: 10, backgroundColor: '#fff' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 40 }}>{this.props.title}</Text>
        </View>
    }
}

class GuestComponent extends Component<GuestObject & { stateSetter: (data: any) => void, refresher: () => void }> {
    render() {
        return <TouchableOpacity onPress={this.props.presente ?
            // se già presente
            () => {
                Alert.alert('Rimuovi presente', `Sei sicuro di voler rimuovere ${this.props.nome} ${this.props.cognome} dalla lista dei presenti? L'invitato verrà rimesso tra i non presenti`, [
                    { text: 'Annulla', style: 'cancel' },
                    {
                        text: 'Rimuovi',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                let res = await fetch('https://peer2peer.altervista.org/comeVoglio.php?remove=1&id=' + this.props.id)
                                let { success, removed } = await res.json()
                                if (success && removed) {
                                    Alert.alert('Rimuovi presente', `${this.props.nome} ${this.props.cognome} è stato rimosso dalla lista dei presenti`)
                                } else {
                                    Alert.alert('Rimuvoi presente', 'Errore sconosciuto, riprova più tardi')
                                }
                                this.props.refresher()
                            } catch (e) {
                                this.props.stateSetter({ error: 'Errore di connessione' })
                            }
                        }
                    }
                ])
            } :
            // se non presente
            () => {
                Alert.alert('Accesso manuale', `Sei sicuro di voler ammettere manualmente ${this.props.nome} ${this.props.cognome}?`, [
                    { text: 'Annulla', style: 'cancel' },
                    {
                        text: 'OK',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                let res = await fetch('https://peer2peer.altervista.org/ingressi.php?id=' + this.props.id)
                                let { success, paid, adult, name, present } = await res.json()
                                if (success) {
                                    fetch('https://peer2peer.altervista.org/comeVoglio.php?id=' + this.props.id)
                                    this.props.stateSetter({ scanned: true, paid, adult, name, present })
                                } else this.props.stateSetter({ error: 'Errore sconosciuto' })
                            } catch (e) {
                                this.props.stateSetter({ error: 'Errore di connessione' })
                            } finally {
                                this.props.stateSetter({ pending: false })
                            }
                        }
                    }
                ])
            }
        }>
            <View style={{ alignSelf: 'stretch', padding: 10 }}>
                <Text style={{ fontSize: 20 }}>{this.props.nome + ' ' + this.props.cognome}</Text>
                <Text>{parseInt(this.props.anno) < 2002 ? 'Maggiorenne' : 'Minorenne'}</Text>
            </View>
        </TouchableOpacity >
    }
}

export default class App extends Component<{}, { refreshing: boolean, data: { title: string, data: GuestObject[] }[], flash: boolean, error?: string } & ScanState> {
    constructor(props) {
        super(props)
        this.state = {
            refreshing: false,
            data: [],
            flash: false,
            scanning: false,
            scanned: false,
            pending: false
        }
        Camera.requestPermissionsAsync()
    }

    componentDidMount() {
        this.refresh()
    }

    async refresh() {
        this.setState({ refreshing: true })
        try {
            let res = await fetch('https://peer2peer.altervista.org/listaButtaFuori.php')
            let data = await res.json()
            let notPresents = {
                title: 'Non presenti',
                data: data.filter(e => e.presente == '0').map(e => {
                    e.presente = false
                    return e
                })
            }
            let presents = {
                title: 'Presenti',
                data: data.filter(e => e.presente == '1').map(e => {
                    e.presente = true
                    return e
                })
            }
            this.setState({ refreshing: false, data: [notPresents, presents], error: undefined })
        } catch (e) {
            this.setState({ refreshing: false, error: 'Errore di connessione' })
        }
    }

    scanned({ data }) {
        this.setState({ scanning: false, pending: true })
        let matches = data.match(/https:\/\/peer2peer\.altervista\.org\/ingressi\.php\?id=(\d+)/)
        let id = matches ? matches[1] : ''
        fetch('https://peer2peer.altervista.org/ingressi.php?id=' + id).then(async res => {
            try {
                let { success, paid, adult, name, present } = await res.json()
                if (success) {
                    fetch('https://peer2peer.altervista.org/comeVoglio.php?id=' + id)
                    this.setState({ scanned: true, paid, adult, name, present })
                } else this.setState({ error: 'QR non valido' })
            } catch (e) {
                this.setState({ error: 'Errore di connessione' })
            } finally {
                this.setState({ pending: false })
            }
        })
    }

    render() {
        return (
            <View style={styles.container}>
                <StatusBar backgroundColor="white" barStyle="dark-content" />
                <Modal
                    visible={this.state.scanning}
                    animationType='slide'
                >
                    <View style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'white'
                    }}>
                        <IconComponent
                            size={60}
                            onPress={() => this.setState({ scanning: false })}
                            style={{
                                position: 'absolute',
                                right: 20,
                                top: 20
                            }}
                            name='ios-close'
                            color='black'
                        />
                        <Camera
                            flashMode={this.state.flash ? 'torch' : 'off'}
                            barCodeScannerSettings={{
                                barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr]
                            }}
                            style={{ width: 300, height: 300 }}
                            onBarCodeScanned={this.scanned.bind(this)}
                        />
                        <View style={{
                            flexDirection: 'row',
                            margin: 20
                        }}>
                            <IconComponent
                                style={{ alignSelf: 'center' }}
                                size={30}
                                name={'ios-flash' + (this.state.flash ? '' : '-off')}
                                color='black'
                            />
                            <Switch
                                style={{ marginLeft: 20 }}
                                value={this.state.flash}
                                onValueChange={flash => { this.setState({ flash }) }}
                            />
                        </View>
                    </View>
                </Modal>
                <Modal
                    visible={this.state.scanned}
                    animationType='slide'
                    onDismiss={() => {
                        setTimeout(() => {
                            this.setState({ pending: false, paid: undefined, adult: undefined, present: undefined, name: undefined, error: undefined })
                        }, 500)
                    }}
                    onRequestClose={() => {
                        console.log('request close')
                        this.setState({ scanned: false })
                    }}
                >
                    <View style={{ flex: 1, alignItems: 'stretch', justifyContent: 'center', backgroundColor: 'white' }}>
                        {
                            <View>
                                <Text style={[styles.resultText, { fontSize: 30, fontWeight: 'bold' }]}>{this.state.name}</Text>
                                <Text style={styles.resultText}>{this.state.adult ? 'Maggiorenne' : 'Minorenne'}</Text>
                                <IconComponent style={{ alignSelf: 'center' }} size={150} name={this.state.present ? 'ios-alert' : (this.state.paid ? 'ios-checkmark' : 'ios-close')} color={this.state.present ? 'yellow' : (this.state.paid ? 'green' : 'red')} />
                                <Text style={[styles.resultText, { fontSize: 25, fontWeight: 'bold' }]}>{this.state.present ? 'Accesso già effettuato' : (this.state.paid ? 'Accesso consentito' : 'Accesso NON consentito')}</Text>
                            </View>
                        }
                        <TouchableHighlight style={{ margin: 20, borderRadius: 10, overflow: 'hidden' }} onPress={() => {
                            this.setState({ scanned: false })
                            this.refresh()
                        }}>
                            <View style={{ padding: 25, alignSelf: 'stretch', backgroundColor: '#ff9000' }}>
                                <Text style={{ textAlign: 'center', fontSize: 20, color: 'white' }}>Scannerizza un nuovo codice</Text>
                            </View>
                        </TouchableHighlight>
                    </View>
                </Modal>
                <Modal
                    visible={!!this.state.error}
                    animationType='slide'
                >
                    <View style={{ flex: 1, alignItems: 'stretch', justifyContent: 'center', backgroundColor: 'white' }}>
                        <Text style={styles.resultText}>{'Errore: ' + this.state.error}</Text>
                        <TouchableHighlight style={{ margin: 20, borderRadius: 10, overflow: 'hidden' }} onPress={() => {
                            this.setState({ error: undefined })
                        }}>
                            <View style={{ padding: 25, alignSelf: 'stretch', backgroundColor: '#ff9000' }}>
                                <Text style={{ textAlign: 'center', fontSize: 20, color: 'white' }}>Chiudi</Text>
                            </View>
                        </TouchableHighlight>
                    </View>
                </Modal>
                <SectionList
                    contentContainerStyle={{ paddingBottom: 100 }}
                    refreshing={this.state.refreshing}
                    onRefresh={this.refresh.bind(this)}
                    sections={this.state.data}
                    renderSectionHeader={({ section }) => <Header title={section.title} />}
                    renderItem={({ item }) => <GuestComponent {...item} stateSetter={this.setState.bind(this)} refresher={this.refresh.bind(this)} />}
                />
                <TouchableHighlight
                    onPress={this.state.pending || this.state.scanning || this.state.scanned ? undefined : () => {
                        this.setState({ scanning: true })
                    }}
                    style={{
                        position: 'absolute',
                        width: Dimensions.get('window').width - 40,
                        bottom: 0,
                        left: 0,
                        margin: 20,
                        borderRadius: 10,
                        overflow: 'hidden'
                    }}
                >
                    <View style={{ flex: 1, backgroundColor: '#ff9000', padding: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, textAlign: 'center' }}>Scanerizza codice QR</Text>
                    </View>
                </TouchableHighlight>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: getStatusBarHeight(),
        backgroundColor: '#fff',
        alignItems: 'stretch',
        justifyContent: 'center',
    },
    resultText: {
        fontSize: 20,
        margin: 4,
        textAlign: 'center'
    }
});
