import { Service, Inject } from 'typedi';
import { UseCase } from '../UseCase';
import { UseCaseOutcome } from '../UseCaseOutcome';
import ResourceNotFoundError from '../../error/ResourceNotFoundError';
import Config from './../../../cfg';
import * as Minercraft from 'minercraft';
import TransactionStillProcessingError from '../../error/TransactionStillProcessingError';
import TransactionDataMissingError from '../../error/TransactionDataMissingError';
import { sync_state } from '../../../core/txsync';

@Service('syncTxStatus')
export default class SyncTxStatus extends UseCase {
  constructor(
    @Inject('merchantapilogService') private merchantapilogService,
    @Inject('txService') private txService,
    @Inject('txsyncService') private txsyncService,
    @Inject('logger') private logger
  ) {
    super();
  }

  /**
  * Whether this is a valid synced statuts
  * @param status merchant api tx status
  */
  public isStatusSuccess(status: any): boolean {
    if (status && status.payload && (status.payload.blockHash && status.payload.blockHash.trim() !== '') &&
      (status.payload.blockHeight) && status.payload.returnResult === 'success') {
      return true;
    }
    return false;
  }

  /**
   * Save the latest tx status and updatet blockhash if needed
   *
   * @param txid txid to save status
   * @param status Merchant api status returned
   */
  public async saveTxStatus(txid: string, status: any): Promise<any> {
    let blockhash = null;
    let blockheight = null;

    if (status && status.payload.blockHash && status.payload.blockHeight && status.payload.returnResult === 'success') {
      blockhash = status.payload.blockHash;
      blockheight = status.payload.blockHeight;
      await this.txService.saveTxStatus(txid, status, blockhash, blockheight);
      await this.txService.setTxCompleted(txid);
    } else {
      await this.txService.saveTxStatus(txid, status, blockhash, blockheight);
    }
  }

  public async run(params: {
    txid: string,
    forceRefresh?: boolean
  }): Promise<UseCaseOutcome> {
    console.log('---------------------synctxstatus------------------------');
    this.logger.info('sync', {
      txid: params.txid,
      trace: 1
    });

    let txsync = await this.txsyncService.getTxsync(params.txid);
    let tx = await this.txService.getTx(params.txid, false);

    if (!tx || !txsync) {
      this.logger.error('sync', {
        txid: params.txid,
        info: 'ResourceNotFoundError',
      });
      throw new ResourceNotFoundError();
    }
    console.log('1', tx.txid, txsync.txid);
    // If the status is acceptable, then just return it
    if (!params.forceRefresh && tx.status && tx.status.valid &&
        tx.status.payload.blockHash && tx.status.payload.blockHeight && tx.status.payload.returnResult === 'success') {

      this.logger.debug('sync', {
        txid: params.txid,
        info: 'already_completed',
      });
      console.log('2', tx.txid, txsync.txid);
      // It should be a 2 for sync_success
      if (txsync.sync !== 2) {
        await this.txService.setTxCompleted(tx.txid);
      }
      console.log('2 return success');
      return {
        success: true,
        result: tx.status
      };
    }
    console.log('3', tx.txid, txsync.txid);
    const miner = new Minercraft({
      url: Config.merchantapi.endpoints[0].url
    });
    let status = await miner.tx.status(params.txid, { verbose: true });

    await this.saveTxStatus(params.txid, status);
    console.log('4', tx.txid, txsync.txid);
    if (Config.merchantapi.response_logging) {
      await this.merchantapilogService.save(status, params.txid);
    }

    if (this.isStatusSuccess(status)) {
      this.logger.debug('sync', {
        txid: params.txid,
        info: 'status_success',
      });
      console.log('5', tx.txid, txsync.txid);
      if (txsync.sync !== 2) {
        await this.txService.setTxCompleted(tx.txid);
      }
      return {
        success: true,
        result: status
      };
    }
    console.log('6', tx.txid, txsync.txid);
    // Check various error conditions and check whether we need to resend or halt
    if (status && status.payload && status.payload.returnResult === 'failure' &&
      status.payload.resultDescription === 'ERROR: No such mempool or blockchain transaction. Use gettransaction for wallet transactions.') {
        console.log('7', tx.txid, txsync.txid);
      // Now load rawtx
      tx = await this.txService.getTx(params.txid, true);
      if (tx.rawtx) {
        this.logger.info('send', {
          txid: tx.txid
        });
        let response = await miner.tx.push(tx.rawtx, {
          verbose: true
        });
        await this.txService.saveTxSend(params.txid, response);

        if (Config.merchantapi.response_logging) {
          await this.merchantapilogService.save(response, params.txid);
        }

        if (response.payload.returnResult === 'failure') {
          this.logger.error('send_error', {
            txid: tx.txid,
            sendPayload: response.payload
          });
          // Something bad, cannot recover
          await this.txService.updateTxsync(params.txid, sync_state.sync_fail);
          return {
            success: true,
            result: status
          };
        }
        console.log('tdddd3yjjjjx as5', tx);
        // Try to update status again since we just broadcasted
        // Update in the background
        setTimeout(async () => {
          status = await miner.tx.status(params.txid, { verbose: true });
          await this.saveTxStatus(params.txid, status);
          if (Config.merchantapi.response_logging) {
            await this.merchantapilogService.save(status, params.txid);
          }
        }, 1000);
      } else {
        console.log('tx ..skw', tx);
        // Note: Let this error out
        // We might want to throw an exception so we can allow user to keep retrying tx's
        this.logger.debug('sync', {
          txid: params.txid,
          info: 'TransactionDataMissingError',
        });
        throw new TransactionDataMissingError();
      }
    }
    console.log('88', tx.txid, txsync.txid);
    this.logger.debug('sync', {
      txid: params.txid,
      info: 'TransactionStillProcessingError',
    });

    // Transaction has not setled
    throw new TransactionStillProcessingError();
  }
}