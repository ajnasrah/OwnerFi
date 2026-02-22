'use client';

import { Transaction } from '../types';

interface TransactionsTabProps {
  transactions: Transaction[];
}

export function TransactionsTab({ transactions }: TransactionsTabProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">&#128202;</div>
        <h3 className="text-xl font-bold text-white mb-2">No transactions</h3>
        <p className="text-slate-400">Transaction history will appear as you accept leads.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                transaction.type === 'agreement_signed' ? 'bg-emerald-500/20 text-emerald-400' :
                transaction.type === 'lead_purchase' ? 'bg-blue-500/20 text-blue-400' :
                'bg-slate-500/20 text-slate-400'
              }`}>
                {transaction.type === 'agreement_signed' ? '\u2713' :
                 transaction.type === 'lead_purchase' ? '\u{1F4DE}' : '\u2022'}
              </div>
              <div>
                <div className="text-white font-medium">{transaction.description}</div>
                <div className="text-slate-400 text-sm">
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
