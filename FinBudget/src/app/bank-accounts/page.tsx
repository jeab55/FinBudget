'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { BankAccount } from '@/lib/types';

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    is_default: false,
  });
  const supabase = createClient();

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    const filtered = accounts.filter(
      (acc) =>
        acc.bank_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.account_number.includes(searchQuery) ||
        (acc.account_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredAccounts(filtered);
  }, [searchQuery, accounts]);

  const fetchAccounts = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (account?: BankAccount) => {
    if (account) {
      setEditingId(account.id);
      setFormData({
        bank_name: account.bank_name,
        account_number: account.account_number,
        account_name: account.account_name || '',
        is_default: account.is_default,
      });
    } else {
      setEditingId(null);
      setFormData({
        bank_name: '',
        account_number: '',
        account_name: '',
        is_default: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      bank_name: '',
      account_number: '',
      account_name: '',
      is_default: false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.bank_name.trim()) {
      alert('กรุณากรอกชื่อธนาคาร');
      return;
    }

    if (!formData.account_number.trim()) {
      alert('กรุณากรอกเลขบัญชี');
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      if (formData.is_default) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      if (editingId) {
        const { error } = await supabase
          .from('bank_accounts')
          .update({
            bank_name: formData.bank_name,
            account_number: formData.account_number,
            account_name: formData.account_name || null,
            is_default: formData.is_default,
          })
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('bank_accounts').insert({
          user_id: user.id,
          bank_name: formData.bank_name,
          account_number: formData.account_number,
          account_name: formData.account_name || null,
          is_default: formData.is_default,
        });

        if (error) throw error;
      }

      handleCloseModal();
      fetchAccounts();
    } catch (error) {
      console.error('Error saving bank account:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือว่าต้องการลบบัญชีธนาคารนี้?')) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting bank account:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await supabase
        .from('bank_accounts')
        .update({ is_default: false })
        .eq('user_id', user.id);

      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      fetchAccounts();
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">บัญชีธนาคาร</h1>
          <p className="text-gray-600 mt-1">จัดการบัญชีธนาคารสำหรับโอนเงิน</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          เพิ่มบัญชี
        </button>
      </div>

      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="ค้นหาบัญชีธนาคาร..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            {searchQuery ? 'ไม่พบบัญชีที่ค้นหา' : 'ยังไม่มีบัญชีธนาคาร'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ธนาคาร</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">เลขบัญชี</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ชื่อบัญชี</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ค่าเริ่มต้น</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">การดำเนิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{account.bank_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{account.account_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{account.account_name || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    {account.is_default ? (
                      <span className="inline-flex items-center gap-1 text-yellow-600 font-medium">
                        <Star size={16} fill="currentColor" />
                        ค่าเริ่มต้น
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(account.id)}
                        className="text-gray-400 hover:text-yellow-600 transition-colors"
                        title="ตั้งเป็นค่าเริ่มต้น"
                      >
                        <Star size={16} />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2 flex">
                    <button
                      onClick={() => handleOpenModal(account)}
                      className="text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingId ? 'แก้ไขบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคาร'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อธนาคาร *
                </label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) =>
                    setFormData({ ...formData, bank_name: e.target.value })
                  }
                  placeholder="เช่น กสิกรไทย, ไทยพาณิชย์"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เลขบัญชี *
                </label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) =>
                    setFormData({ ...formData, account_number: e.target.value })
                  }
                  placeholder="เลขบัญชีธนาคาร"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อบัญชี
                </label>
                <input
                  type="text"
                  value={formData.account_name}
                  onChange={(e) =>
                    setFormData({ ...formData, account_name: e.target.value })
                  }
                  placeholder="ชื่อเจ้าของบัญชี"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) =>
                    setFormData({ ...formData, is_default: e.target.checked })
                  }
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="is_default" className="text-sm font-medium text-gray-700">
                  ตั้งเป็นบัญชีเริ่มต้น
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
